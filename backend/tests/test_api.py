"""API-level tests.

These deliberately run against the **demo** engine (no checkpoint, and torch
need not be installed), so they validate the HTTP contract, validation, and
grading logic on any machine in a couple of seconds.
"""

from __future__ import annotations

import io
import random

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import get_settings
from app.core.detector import InspectionEngine
from app.main import create_app


def _png_bytes(colour: tuple[int, int, int] = (40, 90, 160), size: tuple[int, int] = (320, 240)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, colour).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture()
def client() -> TestClient:
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as test_client:
        # Replace whatever the lifespan built with a forced demo engine, so
        # tests behave identically whether or not a checkpoint exists on disk.
        engine = InspectionEngine(get_settings())
        engine.model = None
        engine.mode = "demo"
        engine.trained = False
        engine.load_error = "forced demo mode for tests"
        app.state.engine = engine
        yield test_client
    get_settings.cache_clear()


def test_health_reports_not_ready_in_demo(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model_ready"] is False


def test_model_endpoint_describes_demo_mode(client: TestClient):
    body = client.get("/api/model").json()
    assert body["mode"] == "demo"
    assert body["trained"] is False
    assert "normal" in body["classes"]  # taxonomy exposed to the UI


def test_root_exposes_service_links(client: TestClient):
    body = client.get("/").json()
    assert body["health"] == "/api/health"
    assert body["docs"] == "/docs"


def test_inspect_returns_full_contract(client: TestClient):
    response = client.post(
        "/api/inspect",
        files={"file": ("fabric.png", _png_bytes(), "image/png")},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["verdict"] in {"pass", "review", "fail"}
    assert 0.0 <= body["quality_score"] <= 100.0
    assert body["model"]["mode"] == "demo"
    assert body["inference_ms"] >= 0.0

    # Annotated preview must be an embeddable PNG data URI.
    assert body["annotated_image"].startswith("data:image/png;base64,")

    for defect in body["defects"]:
        assert defect["severity"] in {"low", "medium", "high", "critical"}
        assert 0.0 <= defect["confidence"] <= 1.0
        if defect["box"] is not None:
            for key in ("x", "y", "w", "h"):
                assert 0.0 <= defect["box"][key] <= 1.0


def test_inspect_is_deterministic_for_identical_files(client: TestClient):
    payload = _png_bytes(colour=(12, 200, 90))
    first = client.post("/api/inspect", files={"file": ("a.png", payload, "image/png")}).json()
    second = client.post("/api/inspect", files={"file": ("b.png", payload, "image/png")}).json()
    assert first["defects"] == second["defects"]
    assert first["quality_score"] == second["quality_score"]


def test_inspect_accepts_jpeg_and_resizes_large_input(client: TestClient):
    buffer = io.BytesIO()
    Image.new("RGB", (1200, 900), (200, 30, 30)).save(buffer, format="JPEG", quality=85)
    response = client.post(
        "/api/inspect",
        files={"file": ("big.jpg", buffer.getvalue(), "image/jpeg")},
    )
    assert response.status_code == 200


def test_inspect_rejects_non_image_payload(client: TestClient):
    response = client.post(
        "/api/inspect",
        files={"file": ("notes.txt", b"this is not an image", "text/plain")},
    )
    assert response.status_code == 422
    assert "decode" in response.json()["detail"].lower()


def test_inspect_rejects_empty_file(client: TestClient):
    response = client.post("/api/inspect", files={"file": ("empty.png", b"", "image/png")})
    assert response.status_code == 400


def test_verdict_for_clean_and_dirty_images(client: TestClient):
    """Different bytes hash to different demo outcomes — exercise both paths."""
    seen: set[str] = set()
    for seed in range(60):
        colour = tuple(random.Random(seed).randrange(0, 255) for _ in range(3))
        body = client.post(
            "/api/inspect",
            files={"file": (f"{seed}.png", _png_bytes(colour), "image/png")},
        ).json()  # type: ignore[assignment]
        seen.add(body["verdict"])
        if not body["defects"]:
            assert body["verdict"] == "pass"
            assert body["quality_score"] == 100.0
        else:
            assert body["verdict"] in {"review", "fail"}
    assert "pass" in seen, "expected at least one clean garment across 60 samples"
