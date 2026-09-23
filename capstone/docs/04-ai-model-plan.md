# 04 — AI Model Plan

## 1. Task definition

**Multi-class image classification** of a single fabric piece view:

| # | Class id | Meaning | Operational effect |
|---|---|---|---|
| 0 | `ok` | No visible defect | PASS (if confidence ≥ θ) |
| 1 | `hole` | Cut / needle hole / tear | FAIL |
| 2 | `stain` | Oil, dye, or soil mark | FAIL |
| 3 | `broken_thread` | Unraveled / missing weft thread line | FAIL |
| 4 | `shade_variation` | Dye lot / uneven tone patch | FAIL |
| 5 | `print_misalignment` | Print offset vs marker | FAIL |

Binary layer for DR-03/DR-04: `defect` = {1..5}, `good` = {0}.

## 2. Dataset strategy

### 2.1 Composition target

| Split | Share | Approx. count (n = 3000) |
|---|---|---|
| Train | 70 % | 2100 |
| Validation | 15 % | 450 (threshold selection) |
| Test (held out) | 15 % | 450 (accuracy evidence only) |

Stratified per class: 500 images/class seed → generator produces procedural weave textures + defect renderings (`ml/generate_dataset.py`), then real captures can be appended (`ml/dataset/real/<class>/`).

### 2.2 Labels & splits on disk

```
ml/dataset/
├── train/<class>/*.png
├── val/<class>/*.png
├── test/<class>/*.png
├── labels.json                 # ["ok","hole",...]
└── dataset_manifest.csv        # path, class, source= synth|real, seed
```

### 2.3 Augmentation (train only)

Random flip, ±10° rotation, brightness/contrast jitter (±15 %), Gaussian noise, small blur — mirrors lighting/exposure variation seen on the line.

### 2.4 Procedural defect controls (for severity sweeps)

Each defect type exposes a **severity ∈ (0,1]** (hole size, stain opacity, thread gap length, shade delta, print offset px). Severity is logged in the manifest so the “output vs input” demonstration can show confidence changing with defect severity (doc 06 §4.2).

## 3. Model selection

| Tier | Model | When used | Size / latency |
|---|---|---|---|
| **Primary** | MobileNetV2 (α=1.0) transfer learning, 224×224, head = 6-way softmax | Default when TensorFlow available | ~9 MB TFLite int8; ~150–300 ms CPU on Pi 5 |
| **Alt 1** | Small custom CNN (4× conv blocks) exported ONNX | Torch/ONNX environments | ~3 MB; fast |
| **Alt 2** | HOG features + RandomForest / SVM (`sklearn`) | No DL runtime available (still meets ≥80% on structured synth set) | <5 MB pickle; <50 ms |

`ml/train.py` auto-selects the best available backend and records which tier produced the artifact in `artifacts/training_meta.json`.

**Why MobileNetV2:** depthwise separable convs suit CPU edge; transfer learning reaches high accuracy with 2k images; TFLite int8 meets DR-02.

## 4. Training protocol

1. Fix seeds (`--seed 42`) for reproducibility.
2. Load stratified splits; class weights if imbalance drifts.
3. Fine-tune: frozen backbone 5 epochs → unfreeze top 30 layers, lr 1e-4, max 25 epochs, early stop on val accuracy (patience 5).
4. Checkpoint best val accuracy → `artifacts/model.*`.
5. Export TFLite/ONNX + `labels.json` + `model_version` string (`mbv2-ts-v1`).
6. Write `artifacts/training_meta.json`: backend, params, epochs, val metrics, dataset hash.

## 5. Evaluation protocol (accuracy evidence ≥ 80%)

`ml/evaluate.py` on **test split only**:

| Output | Purpose |
|---|---|
| `artifacts/evaluation_report.md` | Judge-facing evidence: accuracy, macro F1, DR-03 recall, DR-04 FRR, threshold used |
| `artifacts/confusion_matrix.csv` (+ PNG if matplotlib present) | Per-class behavior |
| `artifacts/predictions.csv` | Every test image: y_true, y_pred, confidence |
| `artifacts/metrics.json` | Machine-readable |

**Threshold selection:** on validation set pick θ maximizing balanced accuracy subject to FRR ≤ 5 %; freeze θ; report test metrics at frozen θ.

## 6. ML rubric (exhibition — see also `ml/rubric.md`)

| Score band | Accuracy (test) | Macro-F1 | Evidence quality |
|---|---|---|---|
| Excellent | ≥ 92 % | ≥ 0.90 | Report + CM + predictions + reproducible seed |
| Good | 85–91 % | 0.80–0.89 | Report + CM + predictions |
| Acceptable (challenge floor) | 80–84 % | 0.70–0.79 | Report + CM |
| Fail | < 80 % | — | Does not meet challenge |

Secondary rubric rows (weights): dataset documentation 15 %, calibration 15 %, latency/DR evidence 20 %, reproducibility 15 %, clarity of errors/confusion analysis 15 %, dashboard/IoT integration 20 %.

## 7. Failure modes & mitigations

| Risk | Mitigation |
|---|---|
| Overfit to synthetic weave | Style randomization (weave frequency, colors, noise); hold out weave styles; add real photos to `real/` |
| Lighting drift on line | Lux guard-band + augmentation brightness; calibration doc 05 |
| Class confusion `stain` vs `shade_variation` | More severity mid-range samples; confusion matrix review loop |
| Threshold too aggressive | Validation-constrained θ; dashboard slider demo |
| Edge latency spike | int8 quantize; camera fixed exposure; pre-allocate tensors |

## 8. Data & model governance

- Dataset card: `ml/dataset_card.md` (sources, splits, labeling, ethical note: no personal data).
- Model card fields inside evaluation report (intended use: garment cut-piece QA; out of scope: medical, human identification).
- Versioning: `model_version` embedded in every verdict payload for traceability.
