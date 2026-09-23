import argparse
import json
import pickle
import time
from pathlib import Path

import numpy as np
from PIL import Image

from generate_dataset import CLASSES

IMG_EXTS = {".png", ".jpg", ".jpeg"}


def load_split(data_dir: Path, split: str, size: int):
    paths, labels = [], []
    split_dir = data_dir / split
    for cls_id, cls in enumerate(CLASSES):
        cls_dir = split_dir / cls
        if not cls_dir.is_dir():
            continue
        for p in sorted(cls_dir.iterdir()):
            if p.suffix.lower() in IMG_EXTS:
                paths.append(p)
                labels.append(cls_id)
    return paths, np.asarray(labels, dtype=np.int64)


def load_image(path: Path, size: int) -> np.ndarray:
    img = Image.open(path).convert("RGB")
    if img.size != (size, size):
        img = img.resize((size, size), Image.BILINEAR)
    return np.asarray(img)


def load_images(paths, size: int) -> np.ndarray:
    return np.stack([load_image(p, size) for p in paths])


def extract_features(images: np.ndarray) -> np.ndarray:
    feats = []
    for img in images:
        pil = Image.fromarray(img).resize((48, 48), Image.BILINEAR)
        arr = np.asarray(pil, dtype=np.float32) / 255.0
        color_small = (
            np.asarray(pil.resize((16, 16), Image.BILINEAR), dtype=np.float32)
            .reshape(-1)
            / 255.0
        )
        gray = arr.mean(axis=2)
        blocks = gray.reshape(6, 8, 6, 8).mean(axis=(1, 3)).reshape(-1)
        gx = np.diff(gray, axis=1, prepend=gray[:, :1])
        gy = np.diff(gray, axis=0, prepend=gray[:1, :])
        grad = np.sqrt(gx**2 + gy**2)
        hist, _ = np.histogram(grad, bins=24, range=(0.0, 2.0))
        hist = hist / max(1.0, hist.sum())
        ch_mean = arr.mean(axis=(0, 1))
        ch_std = arr.std(axis=(0, 1))
        ch_q = np.quantile(arr.reshape(-1, 3), [0.1, 0.5, 0.9], axis=0).reshape(-1)
        local_std = np.array(
            [gray[i : i + 8, j : j + 8].std() for i in range(0, 48, 8) for j in range(0, 48, 8)],
            dtype=np.float32,
        )
        feat = np.concatenate(
            [
                color_small.astype(np.float32),
                blocks.astype(np.float32),
                hist.astype(np.float32),
                ch_mean.astype(np.float32),
                ch_std.astype(np.float32),
                ch_q.astype(np.float32),
                local_std.astype(np.float32),
            ]
        )
        feats.append(feat)
    return np.stack(feats)


class SmallCNN:
    def __new__(cls, n_classes: int):
        import torch
        import torch.nn as nn

        class _Net(nn.Module):
            def __init__(self):
                super().__init__()
                self.net = nn.Sequential(
                    nn.Conv2d(3, 32, 3, padding=1),
                    nn.ReLU(),
                    nn.MaxPool2d(2),
                    nn.Conv2d(32, 64, 3, padding=1),
                    nn.ReLU(),
                    nn.MaxPool2d(2),
                    nn.Conv2d(64, 128, 3, padding=1),
                    nn.ReLU(),
                    nn.AdaptiveAvgPool2d(1),
                    nn.Flatten(),
                    nn.Linear(128, n_classes),
                )

            def forward(self, x):
                return self.net(x)

        return _Net()


def pick_backend(requested: str) -> str:
    if requested != "auto":
        return requested
    for name in ("tensorflow", "torch", "sklearn"):
        try:
            __import__(name)
            return name
        except Exception:
            continue
    raise RuntimeError("No ML backend available (tensorflow/torch/sklearn)")


def train_sklearn(x_train, y_train, x_val, y_val, args) -> dict:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score

    t0 = time.time()
    xtr = extract_features(x_train)
    xva = extract_features(x_val)
    clf = RandomForestClassifier(
        n_estimators=args.trees,
        min_samples_leaf=2,
        max_features="sqrt",
        random_state=args.seed,
        n_jobs=-1,
        class_weight="balanced",
    )
    clf.fit(xtr, y_train)
    val_acc = float(accuracy_score(y_val, clf.predict(xva)))
    model_path = args.out_dir / "model.pkl"
    with model_path.open("wb") as f:
        pickle.dump({"model": clf, "backend": "sklearn", "classes": CLASSES}, f)
    return {
        "backend": "sklearn",
        "val_accuracy": val_acc,
        "train_seconds": round(time.time() - t0, 2),
        "params": {"trees": args.trees, "features": "pixels+gradhist"},
        "artifacts": {"model": str(model_path.name)},
    }


def train_torch(x_train, y_train, x_val, y_val, args) -> dict:
    import torch
    import torch.nn.functional as F
    from torch.utils.data import DataLoader, TensorDataset

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    size = x_train.shape[1]
    xt = torch.from_numpy(x_train.transpose(0, 3, 1, 2)).float() / 255.0
    yt = torch.from_numpy(y_train).long()
    xv = torch.from_numpy(x_val.transpose(0, 3, 1, 2)).float() / 255.0
    yv = torch.from_numpy(y_val).long()
    mean = xt.mean(dim=(0, 2, 3), keepdim=True)
    std = xt.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6)
    xt = (xt - mean) / std
    xv = (xv - mean) / std

    loader = DataLoader(
        TensorDataset(xt, yt), batch_size=args.batch_size, shuffle=True
    )
    model = SmallCNN(len(CLASSES)).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    t0 = time.time()
    best_state, best_acc = None, -1.0
    for epoch in range(args.epochs):
        model.train()
        for bx, by in loader:
            bx, by = bx.to(device), by.to(device)
            opt.zero_grad()
            loss = F.cross_entropy(model(bx), by)
            loss.backward()
            opt.step()
        model.eval()
        with torch.no_grad():
            pred = model(xv.to(device)).argmax(dim=1).cpu().numpy()
        acc = float((pred == yv.numpy()).mean())
        if acc > best_acc:
            best_acc = acc
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        print(f"epoch {epoch + 1}/{args.epochs} val_acc={acc:.4f}")

    assert best_state is not None
    model.load_state_dict(best_state)
    model_path = args.out_dir / "model.pt"
    torch.save(
        {
            "state_dict": model.state_dict(),
            "backend": "torch",
            "classes": CLASSES,
            "size": size,
            "mean": mean.squeeze().tolist(),
            "std": std.squeeze().tolist(),
        },
        model_path,
    )
    return {
        "backend": "torch",
        "val_accuracy": best_acc,
        "train_seconds": round(time.time() - t0, 2),
        "params": {"epochs": args.epochs, "batch": args.batch_size, "lr": args.lr},
        "artifacts": {"model": str(model_path.name)},
    }


def train_tensorflow(x_train, y_train, x_val, y_val, args) -> dict:
    import tensorflow as tf

    size = x_train.shape[1]
    inputs = tf.keras.Input(shape=(size, size, 3))
    x = tf.keras.layers.Rescaling(1 / 255.0)(inputs)
    x = tf.keras.layers.Conv2D(32, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.MaxPooling2D()(x)
    x = tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.MaxPooling2D()(x)
    x = tf.keras.layers.Conv2D(128, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(len(CLASSES), activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    t0 = time.time()
    history = model.fit(
        x_train,
        y_train,
        validation_data=(x_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        verbose=2,
    )
    val_acc = float(max(history.history["val_accuracy"]))
    model_path = args.out_dir / "model.keras"
    model.save(model_path)
    return {
        "backend": "tensorflow",
        "val_accuracy": val_acc,
        "train_seconds": round(time.time() - t0, 2),
        "params": {"epochs": args.epochs, "batch": args.batch_size, "lr": args.lr},
        "artifacts": {"model": str(model_path.name)},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train ThreadSight defect classifier")
    parser.add_argument("--data", default=str(Path(__file__).parent / "dataset"))
    parser.add_argument("--out", default=str(Path(__file__).parent / "artifacts"))
    parser.add_argument("--backend", default="auto", choices=["auto", "tensorflow", "torch", "sklearn"])
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--trees", type=int, default=200)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--size", type=int, default=128)
    args = parser.parse_args()

    np.random.seed(args.seed)
    data_dir = Path(args.data)
    args.out_dir = Path(args.out)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    if not (data_dir / "train" / CLASSES[0]).is_dir():
        raise SystemExit("Dataset missing — run generate_dataset.py first")

    x_train_paths, y_train = load_split(data_dir, "train", args.size)
    x_val_paths, y_val = load_split(data_dir, "val", args.size)
    print(f"train={len(x_train_paths)} val={len(x_val_paths)}")

    backend = pick_backend(args.backend)
    print(f"backend={backend}")

    if backend == "sklearn":
        x_train = load_images(x_train_paths, args.size)
        x_val = load_images(x_val_paths, args.size)
        meta = train_sklearn(x_train, y_train, x_val, y_val, args)
    elif backend == "torch":
        x_train = load_images(x_train_paths, args.size)
        x_val = load_images(x_val_paths, args.size)
        meta = train_torch(x_train, y_train, x_val, y_val, args)
    else:
        x_train = load_images(x_train_paths, args.size)
        x_val = load_images(x_val_paths, args.size)
        meta = train_tensorflow(x_train, y_train, x_val, y_val, args)

    labels_path = data_dir / "labels.json"
    if labels_path.exists():
        labels = json.loads(labels_path.read_text())
    else:
        labels = CLASSES

    meta.update(
        {
            "model_version": f"threadsight-{backend}-v1",
            "classes": labels,
            "seed": args.seed,
            "size": args.size,
            "dataset": str(data_dir),
            "train_count": len(x_train_paths),
            "val_count": len(x_val_paths),
        }
    )
    (args.out_dir / "training_meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
