"""FastAPI application factory.

Run locally with::

    uvicorn app.main:app --reload --app-dir backend
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import get_settings
from .core.detector import InspectionEngine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build the inspection engine once at startup.

    Loading is deliberately tolerant: a missing or corrupt checkpoint leaves
    the service running in demo mode rather than crashing on boot, so the UI
    stays reachable while a model is being trained.
    """
    settings = get_settings()
    engine = InspectionEngine(settings)
    engine.load()

    app.state.engine = engine
    app.state.settings = settings

    if engine.mode == "inference":
        print(f"[startup] Loaded checkpoint for {len(engine.class_names)} classes on {engine.device}.")
    else:
        print(f"[startup] Demo mode — {engine.load_error}")

    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description=(
            "Upload a garment photo to get a defect classification, confidence, "
            "severity, and localized bounding boxes."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "docs": "/docs",
            "health": "/api/health",
        }

    return app


app = create_app()
