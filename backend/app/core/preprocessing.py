"""Image decoding and model-input preprocessing.

Design note
-----------
At inference we resize to a fixed square *without* centre-cropping. Cropping
would preserve aspect ratio but it would also break the mapping between
Grad-CAM coordinates and the original image, forcing an inverse transform to
recover bounding boxes. Squashing to a square keeps that mapping trivial:
normalized box coordinates apply directly to the original image dimensions.

The slight aspect distortion is acceptable for defect classification and is
mirrored by the training pipeline (see ``app.training.dataset``).
"""

from __future__ import annotations

import io
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image, UnidentifiedImageError

if TYPE_CHECKING:  # pragma: no cover - imported only for type checkers
    import torch

# ImageNet statistics — required because the backbone is pretrained on ImageNet.
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class InvalidImageError(ValueError):
    """Raised when the uploaded bytes cannot be decoded as an image."""


def load_image(data: bytes, max_side: int = 2400) -> Image.Image:
    """Decode raw bytes into an RGB PIL image, bounding its dimensions.

    Raises:
        InvalidImageError: if the payload is not a decodable image.
    """
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImageError(
            "Could not decode the upload as an image. "
            "Supported formats: JPEG, PNG, WebP, BMP, TIFF."
        ) from exc

    image = image.convert("RGB")

    # Downscale very large inputs so annotation stays cheap. Boxes are
    # normalized, so resizing here does not shift them.
    if max(image.size) > max_side:
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

    return image


def to_chw_tensor(image: Image.Image, input_size: int) -> "torch.Tensor":
    """Convert a PIL image to a normalized ``(1, 3, S, S)`` float tensor.

    A dependency-free path is used when torch is unavailable (demo mode).
    """
    import torch

    resized = image.resize((input_size, input_size), Image.Resampling.BILINEAR)
    array = np.asarray(resized, dtype=np.float32) / 255.0  # (H, W, 3)

    mean = np.asarray(IMAGENET_MEAN, dtype=np.float32)
    std = np.asarray(IMAGENET_STD, dtype=np.float32)
    array = (array - mean) / std

    # HWC -> CHW
    tensor = torch.from_numpy(np.ascontiguousarray(array.transpose(2, 0, 1)))
    return tensor.unsqueeze(0)
