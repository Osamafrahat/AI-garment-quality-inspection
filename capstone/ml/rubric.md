# ThreadSight ML Rubric (machine/deep learning algorithms)

Use this sheet at the exhibition alongside `artifacts/evaluation_report.md`.

## 1. Accuracy bands (primary)

| Band | Test accuracy | Macro-F1 | Meaning |
|---|---|---|---|
| Excellent | ≥ 92 % | ≥ 0.90 | Production-ready signal |
| **Good** | 85–91 % | 0.80–0.89 | Meets DR-01 target |
| Acceptable (challenge floor) | 80–84 % | 0.70–0.79 | Meets challenge minimum ≥ 80 % |
| Fail | < 80 % | — | Rejected by challenge rules |

## 2. Evidence completeness (required for any passing band)

| Item | Required | Weight |
|---|---|---|
| Held-out test predictions (`predictions.csv`) | ✅ | 15 % |
| Confusion matrix (CSV or figure) | ✅ | 15 % |
| Threshold selection described (val → freeze → test) | ✅ | 10 % |
| Dataset card + splits + labels (`dataset_card.md`) | ✅ | 15 % |
| Reproducible seed + training meta | ✅ | 10 % |
| Error analysis (top confusion pairs + planned fix) | ✅ | 10 % |
| Model version embedded in deployed verdicts | ✅ | 10 % |
| DR-03 recall ≥ 90 % and DR-04 FRR ≤ 5 % reported | ✅ | 15 % |

**Overall ML score = accuracy band score (60 %) + evidence completeness (40 %).**

## 3. Automated gate (CI / exhibition check)

```bash
python evaluate.py --min-accuracy 0.80
# exit code 0 ⇒ accuracy ≥ 80 % and artifacts written
```

## 4. Plagiarism / integrity declaration

| Field | Value |
|---|---|
| Models trained by team | ☐ |
| Pretrained backbone used (allowed if fine-tuned; declare name) | ☐ none / ☐ __________ |
| External images in dataset (declare source) | ☐ none / ☐ __________ |
| Signatures | ______________________ |

## 5. Judge one-liner

> “Accuracy is measured **only** on the held-out test split; θ was frozen on validation; the report and confusion matrix are in `ml/artifacts/`.”
