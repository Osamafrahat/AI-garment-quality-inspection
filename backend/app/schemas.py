"""Pydantic contracts shared by the API layer and the frontend."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Verdict(str, Enum):
    PASS = "pass"
    REVIEW = "review"
    FAIL = "fail"


class DefectBox(BaseModel):
    """Axis-aligned box in normalized coordinates (0..1, origin top-left).

    Normalized coordinates let the frontend overlay boxes on the *original*
    image regardless of how the model resized it internally.
    """

    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    w: float = Field(ge=0.0, le=1.0)
    h: float = Field(ge=0.0, le=1.0)

    @property
    def area_ratio(self) -> float:
        return self.w * self.h


class Defect(BaseModel):
    label: str
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    box: DefectBox | None = None
    #: Fraction of the frame the defect covers; 0.0 when not localized.
    area_ratio: float = Field(default=0.0, ge=0.0, le=1.0)


class ModelInfo(BaseModel):
    """Describes what is actually serving predictions."""

    loaded: bool
    trained: bool
    mode: str = Field(description='"inference" for real weights, "demo" for fallback')
    device: str
    classes: list[str]
    input_size: int
    weights_path: str
    torch_available: bool


class InspectionResult(BaseModel):
    verdict: Verdict
    quality_score: float = Field(ge=0.0, le=100.0)
    defects: list[Defect]
    annotated_image: str | None = Field(
        default=None,
        description='Base64 PNG data URI with detected regions drawn on it ("data:image/png;base64,...").',
    )
    model: ModelInfo
    inference_ms: float


class HealthStatus(BaseModel):
    status: str
    app: str
    environment: str
    model_ready: bool
