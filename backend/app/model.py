"""Backbone construction, shared by training and inference.

Keeping the architecture in one module guarantees that the model rebuilt at
inference time is bit-for-bit compatible with the checkpoint written by
``app.training.train``.
"""

from __future__ import annotations

# Default taxonomy. Training over a labelled folder replaces this with the
# class list stored inside the checkpoint.
DEFAULT_CLASSES: list[str] = [
    "normal",
    "hole",
    "stain",
    "broken_thread",
    "pilling",
    "color_fade",
    "print_misalign",
    "seam_defect",
    "texture_irregular",
    "snag",
]

# Classes that represent "this garment is fine".
CLEAN_LABELS = {"normal", "ok", "good", "pass", "no_defect"}

SUPPORTED_BACKBONES = ("efficientnet_b0", "resnet18", "resnet50")


def build_model(
    num_classes: int,
    backbone: str = "efficientnet_b0",
    pretrained: bool = False,
):
    """Build a classification head on top of a torchvision backbone.

    Args:
        num_classes: Size of the final linear layer.
        backbone: One of :data:`SUPPORTED_BACKBONES`.
        pretrained: Load ImageNet weights. Only useful during training —
            inference passes ``False`` because the checkpoint immediately
            overwrites every weight.
    """
    import torch.nn as nn

    if num_classes < 2:
        raise ValueError(f"num_classes must be >= 2, got {num_classes}")

    if backbone == "efficientnet_b0":
        from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

        weights = EfficientNet_B0_Weights.DEFAULT if pretrained else None
        model = efficientnet_b0(weights=weights)
        in_features = model.classifier[1].in_features
        model.classifier = nn.Sequential(
            nn.Dropout(p=0.3, inplace=True),
            nn.Linear(in_features, num_classes),
        )

    elif backbone in ("resnet18", "resnet50"):
        from torchvision.models import (
            ResNet18_Weights,
            ResNet50_Weights,
            resnet18,
            resnet50,
        )

        if backbone == "resnet18":
            weights = ResNet18_Weights.DEFAULT if pretrained else None
            model = resnet18(weights=weights)
        else:
            weights = ResNet50_Weights.DEFAULT if pretrained else None
            model = resnet50(weights=weights)
        in_features = model.fc.in_features
        model.fc = nn.Linear(in_features, num_classes)

    else:
        raise ValueError(
            f"Unknown backbone {backbone!r}. Expected one of {SUPPORTED_BACKBONES}."
        )

    return model


def find_last_conv(model):
    """Return the last ``nn.Conv2d`` in traversal order.

    Grad-CAM needs a convolutional feature map to differentiate through; for
    every supported backbone the final conv is the correct hook target and is
    always reached last during a depth-first module walk.
    """
    import torch.nn as nn

    target = None
    for module in model.modules():
        if isinstance(module, nn.Conv2d):
            target = module
    if target is None:
        raise ValueError("Model has no Conv2d layer — Grad-CAM is not applicable.")
    return target
