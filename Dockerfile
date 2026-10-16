# Backend image for the garment inspection API.
#
# Build from the REPO ROOT (not backend/), because the app resolves paths
# relative to a backend/ + data/ layout:
#
#   docker build -t garment-api .
#   docker run --rm -p 8000:8000 garment-api
#
# A checkpoint at backend/models/best.pt is picked up automatically if the
# build context has one (fast, reproducible). Otherwise a synthetic dataset is
# generated and EfficientNet-B0 is trained during the build, so a clean
# checkout still produces a working image.

FROM python:3.12-slim

# libgomp: torch's OpenMP runtime. Present in full images, often missing in slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    GARMENT_ENVIRONMENT=production

WORKDIR /workspace

# --- dependencies first, so app edits don't re-download torch ---------------
COPY backend/requirements.txt backend/requirements-ml.txt /workspace/backend/
RUN pip install -r /workspace/backend/requirements.txt \
    && pip install -r /workspace/backend/requirements-ml.txt \
         --index-url https://download.pytorch.org/whl/cpu

# --- application -------------------------------------------------------------
COPY backend/ /workspace/backend/
WORKDIR /workspace/backend

# Generate + train only when no checkpoint came in with the build context.
# Kept deliberately frugal: build containers are often memory-capped (this OOMs
# at batch 32 inside a 3 GB VM), and a build is a bad place to spend 5 minutes.
RUN if [ ! -f models/best.pt ]; then \
        echo "No checkpoint found — generating synthetic data and training..."; \
        python -m app.training.synth --out ../data --train 30 --val 10 --size 224 \
        && python -m app.training.train --data ../data --epochs 2 --batch-size 8 \
                 --device cpu --out models/best.pt \
        && rm -rf ../data; \
    else \
        echo "Reusing checkpoint from build context: $(du -h models/best.pt | cut -f1)"; \
    fi

# Drop test code and caches from the runtime image.
RUN rm -rf tests .pytest_cache __pycache__ app/**/__pycache__

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /workspace
USER appuser

EXPOSE 8000

# Platforms inject $PORT (Render, Railway, HF Spaces). Fall back to 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT','8000'), timeout=4)" || exit 1
