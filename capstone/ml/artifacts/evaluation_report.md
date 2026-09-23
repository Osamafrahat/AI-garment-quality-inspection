# ThreadSight — AI Model Accuracy Evidence

- **Model version:** `threadsight-sklearn-v1`
- **Backend:** `sklearn`
- **Decision threshold θ (frozen from val):** 0.5
- **Test samples:** 450 (held-out, stratified)
- **Seed:** 42

## Headline metrics

| Metric | Value | Target | Status |
|---|---|---|---|
| System accuracy (DR-01) | **90.0%** | ≥ 80% floor / ≥ 85% target | PASS / PASS |
| Macro F1 | 0.900 | ≥ 0.80 (rubric Good) | PASS |
| Defect recall (DR-03) | 100.0% | ≥ 90% | PASS |
| False reject rate (DR-04) | 1.3% | ≤ 5% | PASS |

## Per-class metrics

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| ok | 1.000 | 1.000 | 1.000 | 75 |
| hole | 0.959 | 0.933 | 0.946 | 75 |
| stain | 0.940 | 0.840 | 0.887 | 75 |
| broken_thread | 0.833 | 0.867 | 0.850 | 75 |
| shade_variation | 0.892 | 0.773 | 0.829 | 75 |
| print_misalignment | 0.804 | 0.987 | 0.886 | 75 |

## Confusion matrix (rows = true)

| true \ pred | ok | hole | stain | broken_thread | shade_variation | print_misalignment |
|---|---|---|---|---|---|---|
| ok | 75 | 0 | 0 | 0 | 0 | 0 |
| hole | 0 | 70 | 0 | 1 | 0 | 4 |
| stain | 0 | 2 | 63 | 5 | 2 | 3 |
| broken_thread | 0 | 0 | 1 | 65 | 5 | 4 |
| shade_variation | 0 | 0 | 3 | 7 | 58 | 7 |
| print_misalignment | 0 | 1 | 0 | 0 | 0 | 74 |

## Artifacts

- `metrics.json` — machine-readable metrics
- `confusion_matrix.csv` — raw counts
- `predictions.csv` — per-sample predictions
- `training_meta.json` — training provenance

**Intended use:** garment cut-piece QA on ThreadSight station. **Out of scope:** medical diagnosis, human identification.

## Verdict: >= 80% ACCURACY — CHALLENGE FLOOR MET
