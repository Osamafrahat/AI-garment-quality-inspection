"""Train a garment defect classifier with transfer learning.

Usage (from the ``backend/`` directory)::

    python -m app.training.train --data ../data --epochs 12

Outputs
-------
``models/best.pt``
    Checkpoint consumed by :class:`app.core.detector.InspectionEngine`.
    Contains the weights, the class order, and the backbone name.
``models/class_names.json``
    Class order, so tooling can read it without unpickling a checkpoint.
``models/metrics.json``
    Best validation metrics for the run.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader
except ImportError as exc:  # pragma: no cover - guidance for bare installs
    sys.exit(
        "PyTorch is required for training.\n"
        "  CPU:  pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu\n"
        f"Original error: {exc}"
    )

from ..model import SUPPORTED_BACKBONES, build_model
from .dataset import accuracy, load_datasets, macro_f1

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATA = BACKEND_DIR.parent / "data"
DEFAULT_OUT = BACKEND_DIR / "models" / "best.pt"


def _freeze_backbone(model: nn.Module, frozen: bool) -> list[nn.Parameter]:
    """Toggle requires_grad on everything except the classification head.

    The head is always the final ``classifier`` (EfficientNet) or ``fc``
    (ResNet) submodule, which is the only part reshaped for our class count.
    """
    trainable = []
    for name, param in model.named_parameters():
        is_head = name.startswith("classifier") or name.startswith("fc")
        param.requires_grad = not (frozen and not is_head)
        if param.requires_grad:
            trainable.append(param)
    return trainable


def _run_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer | None,
    device: torch.device,
    scaler: torch.amp.GradScaler | None,
    num_classes: int,
) -> dict[str, float]:
    """Run one pass. ``optimizer is None`` switches to evaluation mode."""
    training = optimizer is not None
    model.train(training)

    total_loss = 0.0
    preds: list[int] = []
    gts: list[int] = []

    for images, targets in loader:
        images = images.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        with torch.set_grad_enabled(training):
            with torch.amp.autocast(device_type=device.type, enabled=scaler is not None):
                logits = model(images)
                loss = criterion(logits, targets)

            if training and optimizer is not None:
                optimizer.zero_grad(set_to_none=True)
                if scaler is not None:
                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    loss.backward()
                    optimizer.step()

        total_loss += float(loss.item()) * images.size(0)
        preds.extend(logits.argmax(dim=1).detach().cpu().tolist())
        gts.extend(targets.detach().cpu().tolist())

    n = max(len(gts), 1)
    return {
        "loss": total_loss / n,
        "accuracy": accuracy(preds, gts),
        "macro_f1": macro_f1(preds, gts, num_classes=num_classes),
    }


def train(args: argparse.Namespace) -> dict:
    torch.manual_seed(args.seed)

    device = torch.device(
        args.device
        if args.device != "auto"
        else ("cuda" if torch.cuda.is_available() else "cpu")
    )
    print(f"Device: {device}")

    train_ds, val_ds, class_names, counts = load_datasets(
        args.data, input_size=args.input_size, val_split=args.val_split, seed=args.seed
    )
    print(f"Classes ({len(class_names)}): {', '.join(class_names)}")
    print(f"Train samples: {len(train_ds)} | Val samples: {len(val_ds)}")

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.workers,
        pin_memory=device.type == "cuda",
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.workers,
        pin_memory=device.type == "cuda",
    )

    model = build_model(
        len(class_names), backbone=args.backbone, pretrained=not args.no_pretrained
    ).to(device)

    # Inverse-frequency class weights: a rare "hole" should not be drowned out
    # by an abundance of clean images.
    weights = []
    for idx in range(len(class_names)):
        seen = max(counts.get(idx, counts.get(class_names[idx], 1)), 1)
        weights.append(len(train_ds) / (len(class_names) * seen))
    criterion = nn.CrossEntropyLoss(
        weight=torch.tensor(weights, dtype=torch.float32).to(device),
        label_smoothing=args.label_smoothing,
    )

    optimizer = torch.optim.AdamW(
        _freeze_backbone(model, frozen=args.freeze_epochs > 0),
        lr=args.lr,
        weight_decay=args.weight_decay,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=max(args.epochs, 1), eta_min=args.lr * 0.05
    )
    scaler = torch.amp.GradScaler(device_type=device.type) if device.type == "cuda" else None

    best_f1 = -1.0
    best_metrics: dict = {}
    history: list[dict] = []
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        epoch_start = time.time()

        # Unfreeze the backbone once the head has had time to settle.
        if args.freeze_epochs and epoch == args.freeze_epochs + 1:
            print("Unfreezing backbone.")
            optimizer = torch.optim.AdamW(
                _freeze_backbone(model, frozen=False), lr=args.lr, weight_decay=args.weight_decay
            )

        train_metrics = _run_epoch(
            model, train_loader, criterion, optimizer, device, scaler, len(class_names)
        )
        val_metrics = _run_epoch(model, val_loader, criterion, None, device, None, len(class_names))
        scheduler.step()

        record = {
            "epoch": epoch,
            "train": train_metrics,
            "val": val_metrics,
            "lr": scheduler.get_last_lr()[0],
            "seconds": round(time.time() - epoch_start, 1),
        }
        history.append(record)

        marker = ""
        if val_metrics["macro_f1"] > best_f1:
            best_f1 = val_metrics["macro_f1"]
            best_metrics = dict(val_metrics)
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "class_names": class_names,
                    "backbone": args.backbone,
                    "input_size": args.input_size,
                    "epoch": epoch,
                    "metrics": best_metrics,
                },
                out_path,
            )
            marker = "  <- saved"

        print(
            f"epoch {epoch:>3}/{args.epochs} "
            f"train f1 {train_metrics['macro_f1']:.3f} acc {train_metrics['accuracy']:.3f} | "
            f"val f1 {val_metrics['macro_f1']:.3f} acc {val_metrics['accuracy']:.3f} "
            f"loss {val_metrics['loss']:.3f} ({record['seconds']}s){marker}"
        )

    # Write sidecar files next to the checkpoint.
    class_names_path = out_path.parent / "class_names.json"
    class_names_path.write_text(json.dumps(class_names, indent=2), encoding="utf-8")

    metrics_path = out_path.parent / "metrics.json"
    metrics_path.write_text(
        json.dumps(
            {
                "best_macro_f1": round(best_f1, 4),
                "best_val": best_metrics,
                "classes": class_names,
                "history": history,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"\nBest val macro-F1: {best_f1:.3f}")
    print(f"Checkpoint: {out_path}")
    print(f"Class names: {class_names_path}")
    print(f"Metrics: {metrics_path}")
    return best_metrics


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="Dataset root containing train/ and optionally val/.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Where to write the checkpoint.")
    parser.add_argument("--backbone", choices=SUPPORTED_BACKBONES, default="efficientnet_b0")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=3e-4, help="Peak learning rate for AdamW.")
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--input-size", type=int, default=224)
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--label-smoothing", type=float, default=0.1)
    parser.add_argument("--freeze-epochs", type=int, default=2, help="Train only the head for the first N epochs (0 = no freezing).")
    parser.add_argument("--workers", type=int, default=0, help="DataLoader workers. 0 is safest on Windows.")
    parser.add_argument("--device", default="auto", help="auto | cpu | cuda | mps")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-pretrained", action="store_true", help="Skip ImageNet weights (for smoke tests).")
    return parser


if __name__ == "__main__":
    train(build_parser().parse_args())
