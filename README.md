# ThreadSight — AI Garment Quality Inspection

Upload a photo of a garment, get back whether it passes QC: the **defect class**,
the model's **confidence**, a **severity tier**, and a **bounding box** around the
affected region.

The detector is a local PyTorch classifier (EfficientNet-B0 by default) trained
with transfer learning. Localization comes from **Grad-CAM**, so the whole thing
needs only image-level labels — you never have to draw boxes by hand.

```
   garment photo
        │
        ▼
  ┌───────────────┐   ┌──────────────────┐   ┌────────────────────┐
  │  FastAPI       │──▶│  CNN classifier  │──▶│ class + confidence │
  │  /api/inspect  │   │  (EfficientNet)  │   └────────────────────┘
  └───────┬───────┘   └────────┬─────────┘
          │                    │ Grad-CAM heatmap
          │                    ▼
          │          ┌──────────────────────┐
          │          │ threshold + segment  │──▶ bounding boxes
          │          └──────────────────────┘
          ▼
   severity scoring ──▶ quality score ──▶ pass / review / fail
          │
          ▼
   annotated PNG + JSON  ──▶  React dashboard
```

---

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows —  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API starts on <http://127.0.0.1:8000>, with interactive docs at `/docs`.

> **No checkpoint yet?** That's fine. With no weights on disk the service runs in
> **demo mode** and returns deterministic placeholder predictions, so the API and
> the UI are fully usable before any training happens. A banner in the UI tells
> you which mode you're in.

`requirements.txt` deliberately excludes PyTorch. Install it only when you want
real inference or training:

```bash
pip install -r requirements-ml.txt --index-url https://download.pytorch.org/whl/cpu
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the backend,
so there's no CORS setup to configure.

### 3. Try it end-to-end

Open <http://localhost:5173> and either drop a photo of fabric, or click one of
the bundled samples (`defect` / `clean`) under the dropzone — they're two
synthetic images shipped with the app, so the full path works before you own any
photos. You'll see the verdict banner, a quality score, the flagged defects with
confidence bars, and boxes drawn over the garment.

---

## Getting real inference

A checkpoint ships with the repo at `backend/models/best.pt`, so a fresh clone
is already in inference mode — the section below is only needed if you want to
retrain or you deleted the weights.

Install the ML extras first (`requirements-ml.txt`), then the fastest way to
produce a checkpoint is the bundled synthetic dataset, which exercises the
entire pipeline end-to-end:

```bash
cd backend
python -m app.training.synth  --out ../data --train 120 --val 30
python -m app.training.train  --data ../data --epochs 12
```

Restart the API and the startup log will read
`[startup] Loaded checkpoint for 10 classes on cpu.` instead of
`[startup] Demo mode`. The synthetic images are obviously fake — they exist to
prove the plumbing works, not to give you an accurate model. Replace them with
real photos for anything that matters.

To confirm the serving path without opening the browser:

```bash
python smoke_infer.py stain hole pilling normal
```

### Training on your own data

Arrange images one folder per class:

```
data/
  train/
    normal/            img_0001.jpg …
    hole/              …
    stain/             …
    broken_thread/     …
    pilling/           …
    color_fade/        …
    print_misalign/    …
    seam_defect/       …
    texture_irregular/ …
    snag/              …
  val/                 (same structure; optional — a split is carved from train/ if omitted)
```

The class names are whatever you name the folders, so the taxonomy is yours to
change. Then:

```bash
python -m app.training.train --data ../data --epochs 20 --backbone efficientnet_b0
```

Useful flags:

| Flag | Default | Why you'd change it |
| --- | --- | --- |
| `--backbone` | `efficientnet_b0` | `resnet18` trains faster, `resnet50` is more accurate |
| `--freeze-epochs` | `2` | Raise it to let the head settle before unfreezing the backbone |
| `--lr` | `3e-4` | Lower it if validation loss swings wildly |
| `--batch-size` | `32` | Raise until you hit a memory limit |
| `--label-smoothing` | `0.1` | Raise if the model is overconfident |
| `--input-size` | `224` | Larger inputs cost more but catch smaller defects |

Outputs land next to the checkpoint:

- `models/best.pt` — weights + class order + backbone name, consumed by the API
- `models/class_names.json` — class order without unpickling anything
- `models/metrics.json` — best validation metrics and the full per-epoch history

Training is judged on **macro-averaged F1**, not accuracy. Garment datasets are
heavily imbalanced — far more clean images than defects — and accuracy will look
excellent while the model learns to always predict "normal".

---

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Service name and pointer to the docs |
| `GET` | `/api/health` | Liveness plus whether a real model is loaded |
| `GET` | `/api/model` | Class list, device, input size, mode |
| `POST` | `/api/inspect` | Multipart image → full inspection result |

`POST /api/inspect` accepts `file` (JPEG, PNG, WebP, BMP, TIFF; ≤ 20 MB) and
returns:

```jsonc
{
  "verdict": "review",          // pass | review | fail
  "quality_score": 78.5,        // 0-100
  "defects": [
    {
      "label": "stain",
      "severity": "high",
      "confidence": 0.913,
      "box": { "x": 0.21, "y": 0.34, "w": 0.18, "h": 0.22 },  // normalized 0..1
      "area_ratio": 0.0396
    }
  ],
  "annotated_image": "data:image/png;base64,…",  // server-rendered preview
  "model": { "mode": "demo", "trained": false, "classes": ["normal", "…"] },
  "inference_ms": 4.2
}
```

Boxes are **normalized** to `0..1` with the origin at the top-left, so the
frontend can overlay them on the original image at any display size.

---

## How it works

**Classification.** A pretrained EfficientNet-B0 has its head replaced with a
linear layer sized to your classes and is fine-tuned with AdamW, a cosine
schedule, class-weighted cross-entropy, and label smoothing. The backbone is
frozen for the first couple of epochs so the randomly initialised head doesn't
destroy the pretrained features.

**Localization.** Grad-CAM back-propagates the score for the predicted class and
averages the gradients into per-channel weights over the last convolutional
feature map. The resulting heatmap highlights the pixels that *caused* the
prediction. It's thresholded, segmented into connected components, and the
largest regions become bounding boxes. This is what lets you train on
image-level labels alone.

**Preprocessing.** Images are resized to a square *without* centre-cropping.
Cropping would preserve aspect ratio but break the mapping between heatmap
coordinates and the original image; squashing keeps that mapping trivial, so
normalized boxes apply directly to the untouched source photo.

**Grading.** Severity is a transparent score, not another model: the defect
type's intrinsic severity, plus escalations for large area and high confidence.
Severity weights sum into a quality score; any critical defect or a score under
55 fails outright, anything imperfect otherwise routes to human review.

---

## Configuration

Settings come from environment variables prefixed `GARMENT_`, or a `.env` file at
the repo root. Copy `.env.example` to `.env` to start.

| Variable | Default | Meaning |
| --- | --- | --- |
| `GARMENT_CORS_ORIGINS` | `http://localhost:5173,…` | Comma-separated allowed origins |
| `GARMENT_MODEL_WEIGHTS` | `backend/models/best.pt` | Checkpoint location |
| `GARMENT_CLASS_NAMES_PATH` | `backend/models/class_names.json` | Class order, read without unpickling the checkpoint |
| `GARMENT_INPUT_SIZE` | `224` | Square side the model expects |
| `GARMENT_DEVICE` | `auto` | `auto`, `cpu`, `cuda`, or `mps` |
| `GARMENT_MAX_IMAGE_SIDE` | `2400` | Larger uploads are downscaled to this before analysis, to bound memory |
| `GARMENT_CONFIDENCE_THRESHOLD` | `0.35` | Predictions below this are dropped |
| `GARMENT_MAX_DEFECTS` | `3` | Cap on returned defects |
| `GARMENT_ALLOW_DEMO_FALLBACK` | `true` | Serve placeholders when no checkpoint exists |

---

## Deployment

The app splits in two, and only the backend carries PyTorch:

| Piece | Target | Why there |
| --- | --- | --- |
| React dashboard | Vercel | 568 KB of static files, no server needed |
| FastAPI + torch | Any Docker host | `torch` is **734 MB** installed — over Vercel's **500 MB** Python limit |

Measured, not guessed: `torch` alone is 508.8 MB on disk, so the API function
would never build on Vercel. The dashboard has no such constraint, so the halves
deploy separately and talk over HTTPS.

### 1. Backend — container

A `Dockerfile` sits at the repo root (build **from the root**, not `backend/`):

```bash
docker build -t garment-api .
docker run --rm -p 8000:8000 garment-api
curl http://127.0.0.1:8000/api/health     # {"status":"ok",...,"model_ready":true}
```

or `docker compose up --build`, which also pre-set CORS for local dev.

The image listens on `${PORT:-8000}`, so Render, Railway and Hugging Face Spaces
can inject their own port. It runs as a non-root user and ships a healthcheck
against `/api/health`.

**Model weights.** `backend/models/best.pt` (15.6 MB) is committed, so a clean
clone or CI build serves real inference immediately — no training at deploy time.
If it's ever missing, the Dockerfile generates a synthetic dataset and trains a
small model during the build instead (kept to batch 8 / 2 epochs because build
containers are often memory-capped — it OOMs at batch 32 inside a 3 GB VM).

### Recommended: the free path (Render + Vercel)

Verified against Render's free limits — 512 MB RAM / 0.1 CPU is tight for
PyTorch, so the Blueprint caps decode size and thread count. Measured
locally under those same settings: **420 MiB peak** on a 3000×4000 photo,
0.8–1.5 s inference, 12.6 s cold start.

**Backend → Render** (Blueprint, no manual config):

1. render.com → **New +** → **Blueprint** → connect this repo.
   Render reads `render.yaml`, builds the Dockerfile and hands you
   `https://garment-api.onrender.com`.
2. Sanity-check it: `curl https://garment-api.onrender.com/api/health`
   → `{"status":"ok",...,"model_ready":true}`.

**Frontend → Vercel:**

3. vercel.com → **Add New Project** → import the repo. Preset **Vite**,
   output `dist` (auto-detected).
4. Set one env var: `VITE_API_BASE=https://garment-api.onrender.com`.
   It is inlined into the JS at **build** time, so it must exist before you
   deploy — adding it later does nothing until you redeploy.

**Close the loop:**

5. Back in Render, set `GARMENT_CORS_ORIGINS=https://<your-app>.vercel.app`
   and let it redeploy.

**What "free" costs you here:** the API sleeps after 15 minutes idle, so the
first request takes 30–60 s to wake it. Inference runs on 0.1 CPU, so expect
2–3 s rather than the 0.3 s you see locally. Bandwidth is capped at 5 GB/month,
and each inspection returns a base64 annotated PNG — that is why
`GARMENT_MAX_IMAGE_SIDE` is capped at 1600 px.

### Other backends

| Platform | How | Cost |
| --- | --- | --- |
| Hugging Face Spaces | New Space → Docker → push this repo | Free, 2 vCPU / 16 GB — **but** some new free accounts report CPU-Basic and Docker Spaces unavailable |
| Railway | `railway init` in the repo, Dockerfile auto-detected | ~$5/mo credit, card required |
| Fly.io | `flyctl launch --no-deploy` then `fly deploy` | ~$6.70/mo — **no free tier** |
| Oracle Always Free | 2 OCPU / 12 GB ARM VM | Free forever, card to sign up, image needs an arm64 rebuild |
| Any VPS | `docker compose up -d` behind a reverse proxy | ~$5/mo |

### 2. Frontend — Vercel

Import the GitHub repo → framework preset **Vite** → build `npm run build`,
output directory `dist`. Then set one environment variable:

```
VITE_API_BASE=https://<your-backend-host>
```

> **This must be set before the build.** `import.meta.env` is inlined into the
> JS bundle at build time, so changing it afterwards does nothing until you
> redeploy. Leave it unset only if a proxy makes `/api` same-origin.

And on the backend, allow your Vercel domain (comma-separated):

```
GARMENT_CORS_ORIGINS=https://your-app.vercel.app
```

**Avoiding CORS entirely:** instead of `VITE_API_BASE`, add a rewrite in
`vercel.json` so the dashboard calls its own `/api` and Vercel proxies it —
same origin, no CORS config:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<your-backend-host>/api/:path*" }
  ]
}
```

---

## Testing

```bash
cd backend
python -m pytest
```

The suite is split so it stays fast on any machine:

- `tests/test_quality.py` — severity scoring and verdict logic, pure and instant
- `tests/test_api.py` — the HTTP contract against the demo engine, no torch needed

Both hold whether or not a checkpoint is on disk: the API tests pin the demo
engine explicitly, so a trained `best.pt` never makes the suite slower or
flakier.

Real inference and training require `torch` and `torchvision`; the API does not,
which is what lets the whole app be developed and tested without a multi-gigabyte
install. `smoke_infer.py` is the counterpart for the path torch *is* required —
it posts held-out images through the live server and prints the verdicts.

---

## Project layout

```
Dockerfile                 Backend image (build from the repo root)
docker-compose.yml         Local / single-box run of the API
render.yaml                Render Blueprint (free Docker web service)
backend/
  requirements.txt        API server + test deps (no torch)
  requirements-ml.txt     torch + torchvision, for training and real inference
  models/best.pt          Trained checkpoint (committed — 15.6 MB)
  smoke_infer.py          Live-server inference smoke test
  app/
    main.py               FastAPI app factory + startup lifespan
    config.py             Settings (GARMENT_ env vars)
    schemas.py            Pydantic contracts shared with the frontend
    model.py              Backbone construction, shared by train and inference
    api/routes.py         /api/health, /api/model, /api/inspect
    core/
      detector.py         Engine: checkpoint loading, Grad-CAM, demo fallback
      severity.py         Defect type + area + confidence → severity tier
      quality.py          Defects → quality score → pass/review/fail
      preprocessing.py    Decode, downscale, normalize
    training/
      dataset.py          ImageFolder loading, augmentation, macro-F1
      train.py            Transfer-learning training loop
      synth.py            Synthetic dataset generator
  tests/
frontend/
  public/                 Bundled sample images for the demo buttons
  src/
    App.tsx               Upload → inspect → display flow
    api/client.ts         Typed fetch wrappers
    components/           UploadZone, ImageViewer, VerdictBanner, DefectList
data/                     train/ and val/ images (gitignored)
```

---

## Next steps

This v1 covers core inference plus the operator UI. Natural extensions:

- **Batch inspection** — point at a folder or CSV, get per-batch pass/fail reports
- **Defect taxonomy config** — per-class thresholds and custom severity maps
- **Persistence** — store inspection history in Postgres with role-based access
- **Export** — TorchScript or ONNX for lower-latency deployment
