"""Dataset loading, augmentation, and evaluation helpers.

Expected on-disk layout (one folder per class)::

    data/
      train/
        normal/          img001.jpg ...
        hole/            ...
        stain/           ...
      val/
        normal/          ...
        hole/            ...

``val/`` is optional — if absent, a stratified split is carved out of
``train/`` so the script still runs on a freshly created dataset.
"""

from __future__ import annotations

import random
from collections import Counter
from pathlib import Path
from typing import Any

from PIL import Image
from torch.utils.data import Dataset, Subset

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

IMG_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}


# --------------------------------------------------------------------- data
class _TransformDataset(Dataset):
    """Applies a transform lazily so the same base data can feed two loaders
    with different augmentations."""

    def __init__(self, base: Any, transform: Any) -> None:
        self.base = base
        self.transform = transform

    def __len__(self) -> int:
        return len(self.base)

    def __getitem__(self, index: int) -> tuple[Any, int]:
        image, label = self.base[index]
        return self.transform(image), label


def build_transforms(input_size: int, train: bool):
    """Inference transforms deliberately mirror ``app.core.preprocessing``:
    a plain square resize with no centre crop, so Grad-CAM coordinates map
    directly back onto the original image."""
    from torchvision import transforms as T

    if not train:
        return T.Compose(
            [
                T.Resize((input_size, input_size), interpolation=T.InterpolationMode.BILINEAR),
                T.ToTensor(),
                T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ]
        )

    return T.Compose(
        [
            T.Resize((input_size, input_size), interpolation=T.InterpolationMode.BILINEAR),
            T.RandomHorizontalFlip(p=0.5),
            T.RandomVerticalFlip(p=0.3),
            T.RandomAffine(degrees=12, translate=(0.08, 0.08), scale=(0.92, 1.08)),
            T.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.25, hue=0.04),
            T.ToTensor(),
            T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            T.RandomErasing(p=0.15, scale=(0.02, 0.12)),
        ]
    )


def _is_image(path: Path) -> bool:
    return path.suffix.lower() in IMG_EXTENSIONS


def load_datasets(
    data_root: Path | str,
    input_size: int,
    val_split: float = 0.2,
    seed: int = 42,
) -> tuple[_TransformDataset, _TransformDataset, list[str], dict[str, int]]:
    """Build train/val datasets plus class names and per-class counts.

    Returns:
        ``(train_ds, val_ds, class_names, counts)``
    """
    from torchvision.datasets import ImageFolder

    root = Path(data_root)
    train_dir = root / "train"
    val_dir = root / "val"

    if not train_dir.is_dir():
        raise FileNotFoundError(
            f"Expected a training folder at {train_dir}. "
            "Create data/train/<class_name>/*.jpg — see the README dataset section, "
            "or generate a synthetic sample with `make synth`."
        )

    base_train = ImageFolder(str(train_dir))
    if not base_train.samples:
        raise RuntimeError(f"No images found under {train_dir}.")
    class_names = list(base_train.classes)

    if val_dir.is_dir():
        base_val = ImageFolder(str(val_dir))
        if list(base_val.classes) != class_names:
            missing = set(class_names) - set(base_val.classes)
            extra = set(base_val.classes) - set(class_names)
            raise RuntimeError(
                "train/ and val/ class folders don't match. "
                f"Missing in val: {sorted(missing) or 'none'}; "
                f"unexpected in val: {sorted(extra) or 'none'}."
            )
    else:
        indices = list(range(len(base_train)))
        random.Random(seed).shuffle(indices)
        n_val = max(1, int(len(indices) * val_split))
        if n_val >= len(indices):
            raise RuntimeError(
                "Dataset too small to split into train/val — add more images "
                "or create an explicit data/val/ folder."
            )
        val_indices = set(indices[:n_val])
        train_indices = [i for i in indices if i not in val_indices]
        full_folder = base_train
        base_train = Subset(full_folder, train_indices)
        base_val = Subset(full_folder, sorted(val_indices))

    counts = Counter(_labels_of(base_train))

    train_ds = _TransformDataset(base_train, build_transforms(input_size, train=True))
    val_ds = _TransformDataset(base_val, build_transforms(input_size, train=False))
    return train_ds, val_ds, class_names, dict(counts)


def _labels_of(dataset: Any) -> list[int]:
    """Return the label of every sample, unwrapping a ``Subset`` if present."""
    underlying = dataset.dataset if isinstance(dataset, Subset) else dataset
    indices = dataset.indices if isinstance(dataset, Subset) else range(len(dataset))
    return [underlying.samples[i][1] for i in indices]


# ------------------------------------------------------------------- metrics
def macro_f1(predictions: list[int], targets: list[int], num_classes: int) -> float:
    """Macro-averaged F1, computed without scikit-learn.

    Macro averaging weights every class equally, which matters here because
    defect classes are typically very imbalanced (far more "normal" than
    "hole" images) and accuracy alone would look great while learning nothing.
    """
    tp = [0] * num_classes
    fp = [0] * num_classes
    fn = [0] * num_classes

    for pred, target in zip(predictions, targets):
        if pred == target:
            tp[target] += 1
        else:
            fp[pred] += 1
            fn[target] += 1

    f1s = []
    for c in range(num_classes):
        precision = tp[c] / (tp[c] + fp[c]) if (tp[c] + fp[c]) else 0.0
        recall = tp[c] / (tp[c] + fn[c]) if (tp[c] + fn[c]) else 0.0
        f1s.append(
            2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        )
    return sum(f1s) / num_classes if num_classes else 0.0


def accuracy(predictions: list[int], targets: list[int]) -> float:
    if not targets:
        return 0.0
    return sum(1 for p, t in zip(predictions, targets) if p == t) / len(targets)
