"""The inspection engine: load weights, run inference, localize defects.

Two modes
---------
``inference``
    A trained checkpoint was found. A CNN classifier predicts the defect class
    and confidence; Grad-CAM produces a class-discriminative heatmap which is
    thresholded and segmented into bounding boxes. This gives spatial
    localization using *only image-level labels* — no box annotations needed.

``demo``
    No checkpoint yet (or torch isn't installed). The engine returns
    deterministic, image-derived placeholder predictions so the API, UI, and
    tests can be exercised end-to-end before any training has happened. The
    same file always yields the same result, which keeps demos reproducible.
"""

from __future__ import annotations

import base64
import hashlib
import io
import random
import time
from dataclasses import dataclass
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from ..config import Settings
from ..model import CLEAN_LABELS, DEFAULT_CLASSES, SUPPORTED_BACKBONES, build_model, find_last_conv
from ..schemas import Defect, DefectBox, ModelInfo, Severity
from .preprocessing import InvalidImageError, load_image, to_chw_tensor
from .quality import decide_verdict, score_garment
from .severity import assess_severity

try:  # torch is optional — the API runs without it in demo mode.
    import torch
    import torch.nn.functional as F

    TORCH_AVAILABLE = True
except Exception:  # pragma: no cover - exercised only on torch-less installs
    torch = None  # type: ignore[assignment]
    F = None  # type: ignore[assignment]
    TORCH_AVAILABLE = False


# Severity -> (outline colour, chip text colour) for annotation.
_SEVERITY_PALETTE: dict[Severity, tuple[tuple[int, int, int], tuple[int, int, int]]] = {
    Severity.LOW: ((255, 196, 0), (20, 14, 0)),
    Severity.MEDIUM: ((255, 122, 0), (20, 10, 0)),
    Severity.HIGH: ((240, 40, 40), (255, 255, 255)),
    Severity.CRITICAL: ((176, 0, 60), (255, 255, 255)),
}


@dataclass
class InspectionOutcome:
    defects: list[Defect]
    annotated: str | None
    inference_ms: float


class GradCAM:
    """Gradient-weighted class activation mapping."""

    def __init__(self, model: Any, target_layer: Any) -> None:
        self.model = model
        self._activations: Any = None
        self._gradients: Any = None
        target_layer.register_forward_hook(self._save_activation)
        target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, _module: Any, _inp: Any, output: Any) -> None:
        self._activations = output.detach()

    def _save_gradient(self, _module: Any, _gin: Any, grad_out: Any) -> None:
        self._gradients = grad_out[0].detach()

    def __call__(self, input_tensor: Any, class_idx: int) -> Any:
        self.model.zero_grad(set_to_none=True)
        logits = self.model(input_tensor)
        logits[0, class_idx].backward()

        gradients = self._gradients
        activations = self._activations
        if gradients is None or activations is None:
            raise RuntimeError("Grad-CAM hooks did not fire — check the target layer.")

        # Average-pool the gradients into per-channel weights, then weight-sum
        # the activation channels and keep only positive evidence.
        weights = gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = F.interpolate(
            cam, size=input_tensor.shape[-2:], mode="bilinear", align_corners=False
        )
        cam = cam[0, 0]

        lo, hi = cam.min(), cam.max()
        if (hi - lo) > 1e-8:
            cam = (cam - lo) / (hi - lo)
        else:
            cam = torch.zeros_like(cam)
        return cam


def _components(mask: Any) -> list[tuple[Any, Any]]:
    """Label 4-connected components in a boolean mask.

    Returns a list of ``(row_indices, col_indices)`` pairs. Pure numpy/Python
    so we don't drag in scipy or OpenCV just for this.
    """
    import numpy as np

    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    found: list[tuple[Any, Any]] = []

    for sy in range(height):
        for sx in range(width):
            if not mask[sy, sx] or visited[sy, sx]:
                continue
            visited[sy, sx] = True
            stack = [(sy, sx)]
            rows: list[int] = []
            cols: list[int] = []
            while stack:
                y, x = stack.pop()
                rows.append(y)
                cols.append(x)
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if (
                        0 <= ny < height
                        and 0 <= nx < width
                        and mask[ny, nx]
                        and not visited[ny, nx]
                    ):
                        visited[ny, nx] = True
                        stack.append((ny, nx))
            if len(rows) >= 4:  # ignore single-pixel speckle
                found.append((np.asarray(rows), np.asarray(cols)))

    return found


class InspectionEngine:
    """Owns the model (when present) and serves inspections."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.model: Any = None
        self.device = "cpu"
        self.class_names: list[str] = list(DEFAULT_CLASSES)
        self.backbone = "efficientnet_b0"
        self.mode = "demo"
        self.trained = False
        self.load_error: str | None = None

    # ------------------------------------------------------------------ load
    def load(self) -> None:
        """Try to load a trained checkpoint; fall back to demo mode."""
        weights = self.settings.model_weights
        self.device = self._pick_device(self.settings.device)

        if not TORCH_AVAILABLE:
            self.load_error = "PyTorch is not installed; running in demo mode."
            self.mode = "demo"
            return

        if not weights.exists():
            self.load_error = (
                f"No checkpoint at {weights}. Run training to produce one "
                "(see README: `make synth && make train`)."
            )
            self.mode = "demo"
            return

        try:
            checkpoint = torch.load(weights, map_location="cpu", weights_only=False)
            if not isinstance(checkpoint, dict) or "model_state" not in checkpoint:
                raise ValueError("Checkpoint is missing the 'model_state' entry.")

            self.backbone = checkpoint.get("backbone", "efficientnet_b0")
            if self.backbone not in SUPPORTED_BACKBONES:
                self.backbone = "efficientnet_b0"

            saved_classes = checkpoint.get("class_names")
            if saved_classes:
                self.class_names = list(saved_classes)

            model = build_model(len(self.class_names), backbone=self.backbone)
            model.load_state_dict(checkpoint["model_state"])
            model.eval().to(self.device)

            self.model = model
            self.mode = "inference"
            self.trained = True
            self.load_error = None

            # Register Grad-CAM hooks once, not per request.
            self._cam = GradCAM(model, find_last_conv(model))
        except Exception as exc:  # noqa: BLE001 - never crash the API on load
            self.model = None
            self.mode = "demo"
            self.trained = False
            self.load_error = f"Failed to load checkpoint: {exc}"

    @staticmethod
    def _pick_device(spec: str) -> str:
        if not TORCH_AVAILABLE:
            return "cpu"
        if spec and spec != "auto":
            return spec
        if torch.cuda.is_available():
            return "cuda"
        mps = getattr(torch.backends, "mps", None)
        if mps is not None and mps.is_available():
            return "mps"
        return "cpu"

    # ------------------------------------------------------------------- info
    def model_info(self) -> ModelInfo:
        return ModelInfo(
            loaded=self.mode == "inference",
            trained=self.trained,
            mode=self.mode,
            device=self.device if TORCH_AVAILABLE else "cpu (torch not installed)",
            classes=list(self.class_names),
            input_size=self.settings.input_size,
            weights_path=str(self.settings.model_weights),
            torch_available=TORCH_AVAILABLE,
        )

    # --------------------------------------------------------------- inspect
    def inspect(self, data: bytes) -> InspectionOutcome:
        """Run a full inspection on raw image bytes."""
        image = load_image(data, max_side=self.settings.max_image_side)

        start = time.perf_counter()
        if self.mode == "inference" and self.model is not None:
            defects = self._predict(image)
        else:
            defects = self._demo_predict(data)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        annotated = _annotate(image, defects)
        return InspectionOutcome(defects=defects, annotated=annotated, inference_ms=elapsed_ms)

    # ------------------------------------------------------- real inference
    def _predict(self, image: Image.Image) -> list[Defect]:
        settings = self.settings
        tensor = to_chw_tensor(image, settings.input_size).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=1)[0].cpu()

        threshold = settings.confidence_threshold
        ranked = torch.argsort(probs, descending=True).tolist()

        # A confident "normal" top-1 means the garment is clean.
        top_label = self.class_names[ranked[0]]
        if top_label.lower() in CLEAN_LABELS and float(probs[ranked[0]]) >= max(threshold, 0.5):
            return []

        candidates = [
            idx
            for idx in ranked
            if self.class_names[idx].lower() not in CLEAN_LABELS
            and float(probs[idx]) >= threshold
        ][: settings.max_defects]

        raw: list[Defect] = []
        for idx in candidates:
            label = self.class_names[idx]
            confidence = float(probs[idx])
            for box, area in self._boxes(tensor, idx):
                raw.append(
                    Defect(
                        label=label,
                        confidence=round(confidence, 4),
                        severity=assess_severity(label, confidence, area),
                        box=box,
                        area_ratio=round(area, 4),
                    )
                )

        # Keep the most significant detections if segmentation was generous.
        raw.sort(key=lambda d: d.confidence * (0.25 + d.area_ratio), reverse=True)
        return raw[: settings.max_defects]

    def _boxes(self, tensor: Any, class_idx: int) -> list[tuple[DefectBox, float]]:
        """Run Grad-CAM for one class and segment it into boxes."""
        import numpy as np

        cam = self._cam(tensor, class_idx).cpu().numpy()  # (S, S) in 0..1
        if cam.max() <= 0:
            return []

        # Work on a quarter-resolution copy: faster labeling, same geometry
        # once coordinates are scaled back up.
        stride = 4
        small = cam[::stride, ::stride]
        peak = float(small.max())
        mask = small >= max(peak * 0.45, 0.30)
        if not mask.any():
            mask = small >= peak * 0.30

        side = cam.shape[0]
        results: list[tuple[DefectBox, float]] = []
        for rows, cols in _components(mask):
            x0 = float(cols.min()) * stride / side
            x1 = (float(cols.max()) + 1) * stride / side
            y0 = float(rows.min()) * stride / side
            y1 = (float(rows.max()) + 1) * stride / side

            x0, x1 = _clamp01(x0), _clamp01(x1)
            y0, y1 = _clamp01(y0), _clamp01(y1)
            w, h = x1 - x0, y1 - y0
            if w < 0.02 or h < 0.02:
                continue

            area = w * h
            results.append((DefectBox(x=x0, y=y0, w=w, h=h), area))

        # Largest regions first — a hairline artifact is not a real defect.
        results.sort(key=lambda pair: pair[1], reverse=True)
        return results[:2]

    # ------------------------------------------------------------ demo mode
    def _demo_predict(self, data: bytes) -> list[Defect]:
        """Deterministic placeholder detections derived from the file bytes."""
        seed = int.from_bytes(hashlib.sha256(data).digest()[:8], "big")
        rng = random.Random(seed)

        defect_classes = [c for c in self.class_names if c.lower() not in CLEAN_LABELS]
        if not defect_classes:
            defect_classes = [c for c in DEFAULT_CLASSES if c.lower() not in CLEAN_LABELS]

        # ~1 in 3 uploads come back clean so the "pass" path is easy to show.
        count = rng.choices([0, 1, 2], weights=[35, 45, 20])[0]
        if count == 0:
            return []

        chosen = rng.sample(defect_classes, k=min(count, len(defect_classes)))
        defects: list[Defect] = []
        for label in chosen:
            confidence = round(rng.uniform(0.56, 0.96), 4)
            width = round(rng.uniform(0.12, 0.38), 4)
            height = round(rng.uniform(0.12, 0.38), 4)
            x = round(rng.uniform(0.0, 1.0 - width), 4)
            y = round(rng.uniform(0.0, 1.0 - height), 4)
            box = DefectBox(x=x, y=y, w=width, h=height)
            area = round(width * height, 4)
            defects.append(
                Defect(
                    label=label,
                    confidence=confidence,
                    severity=assess_severity(label, confidence, area),
                    box=box,
                    area_ratio=area,
                )
            )

        defects.sort(key=lambda d: d.confidence * (0.25 + d.area_ratio), reverse=True)
        return defects[: self.settings.max_defects]

    # ----------------------------------------------------------------- utils
    @staticmethod
    def verdict_and_score(defects: list[Defect]) -> tuple[str, float]:
        score = score_garment(defects)
        return decide_verdict(score, defects).value, round(score, 1)


def _clamp01(value: float) -> float:
    return min(max(value, 0.0), 1.0)


def _annotate(image: Image.Image, defects: list[Defect]) -> str:
    """Draw detected regions onto a copy of the image and return a data URI."""
    canvas = image.copy()
    draw = ImageDraw.Draw(canvas)
    width_px, height_px = canvas.size

    line_width = max(2, int(min(width_px, height_px) * 0.006))
    font_size = max(12, int(min(width_px, height_px) * 0.030))
    try:
        font = ImageFont.load_default(size=font_size)
    except TypeError:  # pragma: no cover - Pillow < 10.1
        font = ImageFont.load_default()

    padding = max(3, line_width * 2)

    for defect in defects:
        if defect.box is None:
            continue

        outline, text_colour = _SEVERITY_PALETTE[defect.severity]
        x0 = defect.box.x * width_px
        y0 = defect.box.y * height_px
        x1 = (defect.box.x + defect.box.w) * width_px
        y1 = (defect.box.y + defect.box.h) * height_px

        draw.rectangle([x0, y0, x1, y1], outline=outline, width=line_width)

        label = (
            f"{defect.label} · {defect.confidence * 100:.0f}% · "
            f"{defect.severity.value.upper()}"
        )
        left, top, right, bottom = draw.textbbox((0, 0), label, font=font)
        text_w, text_h = right - left, bottom - top

        chip_w = text_w + padding * 2
        chip_h = text_h + padding * 2

        # Prefer the chip above the box; flip inside if it would clip the top.
        chip_x = min(max(x0, 0.0), max(width_px - chip_w, 0.0))
        chip_y = y0 - chip_h
        if chip_y < 0:
            chip_y = min(y0 + line_width, max(height_px - chip_h, 0.0))

        draw.rectangle(
            [chip_x, chip_y, chip_x + chip_w, chip_y + chip_h], fill=outline
        )
        draw.text(
            (chip_x + padding - left, chip_y + padding - top),
            label,
            fill=text_colour,
            font=font,
        )

    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


__all__ = ["InspectionEngine", "InspectionOutcome", "GradCAM", "InvalidImageError"]
