import json
import pickle
from pathlib import Path

import numpy as np
from PIL import Image

from .config import Config

DEFAULT_CLASSES = [
    "ok",
    "hole",
    "stain",
    "broken_thread",
    "shade_variation",
    "print_misalignment",
]


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
            [
                gray[i : i + 8, j : j + 8].std()
                for i in range(0, 48, 8)
                for j in range(0, 48, 8)
            ],
            dtype=np.float32,
        )
        feats.append(
            np.concatenate(
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
        )
    return np.stack(feats)


class InferenceEngine:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.backend = "heuristic"
        self.model = None
        self.classes = list(DEFAULT_CLASSES)
        self.model_version = "heuristic-mock-v1"
        self._load()

    def _load(self) -> None:
        art = self.config.artifacts_dir
        meta_path = art / "training_meta.json"
        meta = {}
        if meta_path.is_file():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            self.classes = meta.get("classes", self.classes)
            self.model_version = meta.get("model_version", self.model_version)

        model_pkl = art / "model.pkl"
        if model_pkl.is_file():
            try:
                with model_pkl.open("rb") as f:
                    payload = pickle.load(f)
                self.model = payload["model"]
                self.backend = "sklearn"
                self.classes = payload.get("classes", self.classes)
                return
            except Exception:
                self.model = None

        model_pt = art / "model.pt"
        if model_pt.is_file():
            try:
                import torch

                from .camera import Camera  # noqa: F401

                payload = torch.load(model_pt, map_location="cpu", weights_only=False)
                import train as train_mod  # type: ignore

                self.model = train_mod.SmallCNN(len(payload["classes"]))
                self.model.load_state_dict(payload["state_dict"])
                self.model.eval()
                self.classes = payload["classes"]
                self.model_version = f"torch-{self.model_version}"
                self.backend = "torch"
                self._torch_payload = payload
                return
            except Exception:
                self.model = None

        self.backend = "heuristic"

    def predict(self, image: np.ndarray) -> dict[str, float]:
        if self.backend == "sklearn":
            probs = self.model.predict_proba(extract_features(image[None, ...]))[0]
            return {c: float(p) for c, p in zip(self.classes, probs)}
        if self.backend == "torch":
            import torch

            p = self._torch_payload
            x = torch.from_numpy(image.transpose(2, 0, 1)).float().unsqueeze(0) / 255.0
            mean = torch.tensor(p["mean"]).view(1, 3, 1, 1)
            std = torch.tensor(p["std"]).view(1, 3, 1, 1)
            x = (x - mean) / std
            with torch.no_grad():
                probs = torch.softmax(self.model(x), dim=1).numpy()[0]
            return {c: float(v) for c, v in zip(self.classes, probs)}
        return self._heuristic(image)

    def _heuristic(self, image: np.ndarray) -> dict[str, float]:
        arr = image.astype(np.float32)
        gray = arr.mean(axis=2)
        scores = {c: 0.05 for c in self.classes}
        dark_ratio = float((gray < 40).mean())
        std = float(gray.std())
        gx = np.abs(np.diff(gray, axis=1)).mean()
        col_std = float(arr.std(axis=(0, 1)).mean())
        if dark_ratio > 0.01:
            scores["hole"] += min(0.9, dark_ratio * 20)
        if col_std > 55 and gray.mean() > 100:
            scores["stain"] += 0.35
        if gx > 12:
            scores["broken_thread"] += 0.4
        if std > 45:
            scores["shade_variation"] += 0.45
        scores["print_misalignment"] += 0.08 if gx > 8 else 0.0
        if max(scores.values()) <= 0.15:
            scores["ok"] = 0.85
        total = sum(scores.values())
        return {c: v / total for c, v in scores.items()}
