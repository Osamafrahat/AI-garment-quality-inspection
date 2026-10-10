"""Application configuration.

All settings can be overridden with environment variables prefixed by
``GARMENT_`` (or via a local ``.env`` file). See ``.env.example`` at the repo
root for the full list.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory (this file lives at backend/app/config.py).
BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration for the inspection API."""

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_prefix="GARMENT_",
        extra="ignore",
        validate_default=True,
    )

    app_name: str = "AI Garment Quality Inspection"
    environment: str = "development"

    # Comma-separated browser origins allowed to call the API.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Model artifacts. Defaults resolve to backend/models/.
    model_weights: Path = Field(default=BACKEND_DIR / "models" / "best.pt")
    class_names_path: Path = Field(default=BACKEND_DIR / "models" / "class_names.json")

    # Inference
    input_size: int = 224
    device: str = "auto"  # auto | cpu | cuda | mps
    confidence_threshold: float = 0.35
    # How many candidate boxes to extract from the Grad-CAM heatmap.
    max_defects: int = 3

    # When weights are missing, fall back to deterministic demo predictions so
    # the API and UI remain usable before any training has happened.
    allow_demo_fallback: bool = True

    # A JPEG/PNG larger than this is downscaled before annotation to bound
    # memory use. Bounding boxes are normalized, so accuracy is unaffected.
    max_image_side: int = 2400

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
