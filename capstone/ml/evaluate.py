import argparse
import csv
import json
import pickle
import sys
from pathlib import Path

import numpy as np

from generate_dataset import CLASSES
from train import SmallCNN, extract_features, load_images, load_split


def load_artifact(art_dir: Path):
    meta = json.loads((art_dir / "training_meta.json").read_text())
    backend = meta["backend"]
    if backend == "sklearn":
        with (art_dir / "model.pkl").open("rb") as f:
            payload = pickle.load(f)
        return meta, payload
    if backend == "torch":
        import torch

        payload = torch.load(art_dir / "model.pt", map_location="cpu", weights_only=False)
        model = SmallCNN(len(payload["classes"]))
        model.load_state_dict(payload["state_dict"])
        model.eval()
        return meta, {"model": model, "payload": payload}
    if backend == "tensorflow":
        import tensorflow as tf

        model = tf.keras.models.load_model(art_dir / "model.keras")
        return meta, {"model": model}
    raise ValueError(f"Unknown backend {backend}")


def predict_proba(backend: str, payload, images: np.ndarray) -> np.ndarray:
    if backend == "sklearn":
        feats = extract_features(images)
        return payload["model"].predict_proba(feats)
    if backend == "torch":
        import torch

        p = payload["payload"]
        x = torch.from_numpy(images.transpose(0, 3, 1, 2)).float() / 255.0
        mean = torch.tensor(p["mean"]).view(1, 3, 1, 1)
        std = torch.tensor(p["std"]).view(1, 3, 1, 1)
        x = (x - mean) / std
        with torch.no_grad():
            logits = payload["model"](x)
            return torch.softmax(logits, dim=1).numpy()
    if backend == "tensorflow":
        probs = payload["model"].predict(images, verbose=0)
        return np.asarray(probs)
    raise ValueError(backend)


def confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, n: int) -> np.ndarray:
    cm = np.zeros((n, n), dtype=np.int64)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1
    return cm


def select_threshold(probs: np.ndarray, y_val: np.ndarray, max_frr: float) -> float:
    ok_idx = CLASSES.index("ok")
    best = 0.50
    for theta in np.arange(0.50, 0.96, 0.01):
        pred_ok = probs[:, ok_idx] >= theta
        is_ok = y_val == ok_idx
        if is_ok.sum() == 0:
            continue
        frr = float((~pred_ok[is_ok]).mean())
        defect_recall = float((~pred_ok[~is_ok]).mean()) if (~is_ok).any() else 1.0
        if frr <= max_frr and defect_recall >= 0.90:
            best = float(theta)
            break
        if frr <= max_frr:
            best = float(theta)
    return round(best, 2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate ThreadSight model accuracy")
    parser.add_argument("--data", default=str(Path(__file__).parent / "dataset"))
    parser.add_argument("--artifacts", default=str(Path(__file__).parent / "artifacts"))
    parser.add_argument("--min-accuracy", type=float, default=0.80)
    parser.add_argument("--max-frr", type=float, default=0.05)
    parser.add_argument("--size", type=int, default=128)
    args = parser.parse_args()

    data_dir = Path(args.data)
    art_dir = Path(args.artifacts)
    meta, payload = load_artifact(art_dir)
    backend = meta["backend"]

    val_paths, y_val = load_split(data_dir, "val", args.size)
    test_paths, y_test = load_split(data_dir, "test", args.size)
    if len(test_paths) == 0:
        raise SystemExit("No test split found")

    x_val = load_images(val_paths, args.size)
    x_test = load_images(test_paths, args.size)
    probs_val = predict_proba(backend, payload, x_val)
    probs_test = predict_proba(backend, payload, x_test)

    theta = select_threshold(probs_val, y_val, args.max_frr)
    y_pred = probs_test.argmax(axis=1)
    conf = probs_test.max(axis=1)
    ok_idx = CLASSES.index("ok")

    decisions = []
    for p, c in zip(y_pred, conf):
        if p != ok_idx or c < theta:
            decisions.append("FAIL")
        else:
            decisions.append("PASS")
    decisions = np.asarray(decisions)

    accuracy = float((y_pred == y_test).mean())
    n_classes = len(CLASSES)
    cm = confusion_matrix(y_test, y_pred, n_classes)

    per_class = {}
    for i, cls in enumerate(CLASSES):
        tp = cm[i, i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        per_class[cls] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "support": int(cm[i, :].sum()),
        }

    defect_mask = y_test != ok_idx
    ok_mask = ~defect_mask
    defect_recall = float((decisions[defect_mask] == "FAIL").mean()) if defect_mask.any() else 1.0
    false_reject = float((decisions[ok_mask] == "FAIL").mean()) if ok_mask.any() else 0.0
    macro_f1 = float(np.mean([per_class[c]["f1"] for c in CLASSES]))

    metrics = {
        "model_version": meta.get("model_version"),
        "backend": backend,
        "threshold": theta,
        "accuracy": round(accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "defect_recall_dr03": round(defect_recall, 4),
        "false_reject_rate_dr04": round(false_reject, 4),
        "test_samples": int(len(test_paths)),
        "min_accuracy_required": args.min_accuracy,
        "pass_challenge_floor": accuracy >= args.min_accuracy,
        "pass_dr01_target": accuracy >= 0.85,
        "pass_dr03": defect_recall >= 0.90,
        "pass_dr04": false_reject <= args.max_frr,
        "per_class": per_class,
    }

    art_dir.mkdir(parents=True, exist_ok=True)
    (art_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))

    with (art_dir / "confusion_matrix.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["true\\pred"] + CLASSES)
        for i, cls in enumerate(CLASSES):
            w.writerow([cls] + [int(v) for v in cm[i]])

    with (art_dir / "predictions.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["path", "y_true", "y_pred", "confidence", "decision", "threshold"])
        for path, yt, yp, conf_i, dec in zip(
            test_paths, y_test, y_pred, conf, decisions
        ):
            w.writerow(
                [
                    str(path),
                    CLASSES[yt],
                    CLASSES[yp],
                    round(float(conf_i), 4),
                    dec,
                    theta,
                ]
            )

    lines = [
        "# ThreadSight — AI Model Accuracy Evidence",
        "",
        f"- **Model version:** `{meta.get('model_version')}`",
        f"- **Backend:** `{backend}`",
        f"- **Decision threshold θ (frozen from val):** {theta}",
        f"- **Test samples:** {len(test_paths)} (held-out, stratified)",
        f"- **Seed:** {meta.get('seed')}",
        "",
        "## Headline metrics",
        "",
        "| Metric | Value | Target | Status |",
        "|---|---|---|---|",
        f"| System accuracy (DR-01) | **{accuracy:.1%}** | ≥ 80% floor / ≥ 85% target | "
        f"{'PASS' if accuracy >= 0.80 else 'FAIL'} / {'PASS' if accuracy >= 0.85 else 'below target'} |",
        f"| Macro F1 | {macro_f1:.3f} | ≥ 0.80 (rubric Good) | {'PASS' if macro_f1 >= 0.8 else '—'} |",
        f"| Defect recall (DR-03) | {defect_recall:.1%} | ≥ 90% | {'PASS' if defect_recall >= 0.9 else 'FAIL'} |",
        f"| False reject rate (DR-04) | {false_reject:.1%} | ≤ 5% | {'PASS' if false_reject <= 0.05 else 'FAIL'} |",
        "",
        "## Per-class metrics",
        "",
        "| Class | Precision | Recall | F1 | Support |",
        "|---|---|---|---|---|",
    ]
    for cls in CLASSES:
        m = per_class[cls]
        lines.append(
            f"| {cls} | {m['precision']:.3f} | {m['recall']:.3f} | {m['f1']:.3f} | {m['support']} |"
        )
    lines += [
        "",
        "## Confusion matrix (rows = true)",
        "",
        "| true \\ pred | " + " | ".join(CLASSES) + " |",
        "|---|" + "|".join(["---"] * len(CLASSES)) + "|",
    ]
    for i, cls in enumerate(CLASSES):
        lines.append("| " + cls + " | " + " | ".join(str(int(v)) for v in cm[i]) + " |")
    lines += [
        "",
        "## Artifacts",
        "",
        "- `metrics.json` — machine-readable metrics",
        "- `confusion_matrix.csv` — raw counts",
        "- `predictions.csv` — per-sample predictions",
        "- `training_meta.json` — training provenance",
        "",
        "**Intended use:** garment cut-piece QA on ThreadSight station. "
        "**Out of scope:** medical diagnosis, human identification.",
        "",
        f"## Verdict: {'>= 80% ACCURACY — CHALLENGE FLOOR MET' if accuracy >= 0.80 else 'BELOW 80% — NOT ACCEPTABLE'}",
    ]
    report_path = art_dir / "evaluation_report.md"
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({k: metrics[k] for k in metrics if k != "per_class"}, indent=2))
    print(f"report: {report_path}")
    if accuracy < args.min_accuracy:
        print(
            f"FAIL: accuracy {accuracy:.3f} < required {args.min_accuracy}",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
