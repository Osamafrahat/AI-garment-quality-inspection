"""HTTP endpoints for the inspection service."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from ..config import get_settings
from ..core.detector import InspectionEngine, InvalidImageError
from ..schemas import HealthStatus, InspectionResult, ModelInfo

router = APIRouter(prefix="/api", tags=["inspection"])

# 20 MB — generous for phone photos, small enough to bound memory.
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def _engine(request: Request) -> InspectionEngine:
    engine = getattr(request.app.state, "engine", None)
    if engine is None:  # pragma: no cover - lifespan always installs one
        raise HTTPException(status_code=503, detail="Inspection engine not initialised.")
    return engine


@router.get("/health", response_model=HealthStatus, summary="Liveness + readiness")
def health(request: Request) -> HealthStatus:
    settings = get_settings()
    return HealthStatus(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
        model_ready=_engine(request).mode == "inference",
    )


@router.get("/model", response_model=ModelInfo, summary="Describe the serving model")
def model_info(request: Request) -> ModelInfo:
    return _engine(request).model_info()


@router.post("/inspect", response_model=InspectionResult, summary="Inspect one garment image")
async def inspect(
    request: Request,
    file: UploadFile = File(..., description="A JPEG/PNG/WebP photo of the garment."),
) -> InspectionResult:
    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    engine = _engine(request)
    try:
        outcome = engine.inspect(data)
    except InvalidImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    verdict, score = engine.verdict_and_score(outcome.defects)

    return InspectionResult(
        verdict=verdict,
        quality_score=score,
        defects=outcome.defects,
        annotated_image=outcome.annotated,
        model=engine.model_info(),
        inference_ms=round(outcome.inference_ms, 1),
    )
