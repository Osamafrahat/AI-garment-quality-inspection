# ThreadSight Dataset Card

| Field | Value |
|---|---|
| Name | `threadsight-fabric-defects-synth-v1` |
| Owner | ThreadSight capstone team |
| Version | 1.0 |
| Modality | RGB images, 128×128 PNG (resized to model input) |
| License | Team / school exhibition use |
| Personal data | **None** (no faces, no PII) |

## Purpose

Train and evaluate the ThreadSight fabric quality classifier used in the industrial quality-inspection prototype (DR-01…DR-04).

## Composition

| Class id | Class | Semantics | Target share |
|---|---|---|---|
| 0 | `ok` | defect-free weave | 1/6 |
| 1 | `hole` | cut/tear with fray | 1/6 |
| 2 | `stain` | colored contamination | 1/6 |
| 3 | `broken_thread` | missing weft/warp line | 1/6 |
| 4 | `shade_variation` | uneven dye tone | 1/6 |
| 5 | `print_misalignment` | offset print motif | 1/6 |

Default size: **500 images/class → 3000 total**, split 70/15/15 (train/val/test), stratified.

## Collection / generation

- **Source `synth`:** procedural weave textures + defect renderers in `generate_dataset.py` (seeded, reproducible).
- **Source `real` (growth path):** photos captured with the exhibition camera under the calibrated light tunnel; place under `dataset/<split>/<class>/` and re-run train/evaluate; set `source=real` in manifest rows.
- Severity parameter ∈ {0.25 … 1.0} logged per defect image for severity-sweep demos.

## Labels

- Multi-class label per image (`class`, `class_id` in `dataset_manifest.csv`).
- Binary derivation for DR-03/DR-04: `ok` → good; all else → defect.
- Labeling rule: synthetic labels are exact by construction; real photos labeled by two team members (disagreements resolved by third).

## Splits

| Split | Files | Used for |
|---|---|---|
| `train/` | 70 % | weight updates |
| `val/` | 15 % | early stop + threshold θ selection |
| `test/` | 15 % | **accuracy evidence only** (never trained on) |

## Known limitations

- Synthetic textures may under-represent factory dirt/wrinkle variety → mitigate with `real/` captures before final exhibition freeze.
- Single-view images; no multi-angle QA yet.
- Not a benchmark for woven vs knitted distinction.

## Distribution

Exhibited on USB + printed sample grid; full files under `capstone/ml/dataset/`.

## Maintenance

Regenerate with: `python generate_dataset.py --per-class 500 --seed 42`.
