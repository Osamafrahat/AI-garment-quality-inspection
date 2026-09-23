# 01 — Project Proposal: ThreadSight

## 1. Title

**ThreadSight — AI-Based Garment Quality Inspection & Line-Monitoring Node**

## 2. Pathway selection

| Item | Value |
|---|---|
| Pathway | **A. Industrial Base** |
| Sub-challenge | *Product quality inspection and control* (also supports *fully automated production lines*) |
| School-board approval note | In-line visual QA for cut-fabric pieces is a standard apparel-industry need; no restricted/hazardous materials used. |

Why not B/Education or C/Medical: the workspace already contains a clothes-production planning workbook (`Clothes_Industry_Production.xlsx` — cuts, product lines, sizes, on-time delivery). ThreadSight closes the loop from *planning* to *verified quality* on the same two product lines (Line A T-Shirt, Line B Polo).

## 3. Problem statement

Manual fabric inspection at cutting rooms is slow, subjective, and inconsistent:

- Inspectors disagree on borderline defects (shade variation, light stains).
- Reaction to a bad batch happens late — defective pieces already move to sewing.
- No machine-readable quality record is attached to each **Cut #** for traceability.
- Lighting conditions drift during a shift, silently changing what inspectors (and cameras) see.

**Goal:** a portable inspection station that senses the piece + environment, applies an AI classifier to a captured image, actuates a local PASS/FAIL indication (and optional reject gate), and communicates results through IoT channels to a dashboard — expanding the industrial base with a deployable, measurable QA device.

## 4. Solution overview

```
Fabric piece → [LED light tunnel] → Pi Camera → Raspberry Pi 5 (AI edge)
                     ↑                                │
        calibrated sensors (lux, temp/hum, ToF)       │ PASS/FAIL: OLED + RGB + buzzer + relay
                                                      ▼
                                    MQTT + REST → Gateway → SSE → Web dashboard
                                                      ▲
                                    Cut schedule (product line, Cut #, target sizes)
```

1. **Sense** — camera image + lux / temperature / humidity / distance (presence) measurements.
2. **Measure** — calibrated sensor values, illumination guard-band check.
3. **Decide (AI)** — 6-class defect classifier (`ok`, `hole`, `stain`, `broken_thread`, `shade_variation`, `print_misalignment`) + confidence threshold.
4. **Act** — local indication and optional reject-gate relay pulse.
5. **Communicate** — MQTT/REST up-link; cut-schedule down-link; live dashboard.
6. **Learn** — logged images + verdicts feed dataset growth and model retraining.

## 5. Measurable design requirements (preview — full matrix in 02)

| ID | Requirement | Target |
|---|---|---|
| DR-01 | AI system accuracy (held-out test set) | **≥ 85%** (evidence floor 80%) |
| DR-02 | Response time: capture → verdict → actuator | **≤ 800 ms** (dashboard ≤ 3 s) |
| DR-03 | Defect detection rate (recall on defective pieces) | **≥ 90%** |
| DR-04 | False-reject rate on good pieces | **≤ 5%** |
| DR-05* | Inspection throughput | **≥ 12 pieces/min** |
| DR-06* | IoT telemetry delivery (≤ 3 s to dashboard) | **≥ 99%** |

\* two application-specific choices required by the challenge.

## 6. Platform compliance

| Constraint | Compliance |
|---|---|
| ICT | Web dashboard, REST, SSE, structured logging, exhibition dataset/rubric |
| IoT | MQTT topics + local gateway + telemetry/actuation messages |
| AI | CNN/TFLite (or ONNX) classifier; accuracy evidence + confusion matrix |
| Hardware | Raspberry Pi 5, Pi Camera Module 3, BH1750, BME280, VL53L0X, SSD1306, LED/buzzer/relay |
| No Arduino | **Raspberry Pi 5** (64-bit quad-core SoC, Linux) used as controller |
| Output vs input change | Confidence-threshold sweep, defect-severity sweep, lux sweep (see 06) |
| No lab material removal | All lab-equipment reference calibrations performed in lab; only own BOM travels |
| Chronic disease / medical hazards | N/A (industrial pathway); low-voltage 5 V electronics only |

## 7. Team roles (template — customize per member)

| Role | Responsibilities | Logbook focus |
|---|---|---|
| Edge/Hardware lead | Wiring, sensors, calibration, actuator | Calib records, power budget |
| AI/ML lead | Dataset, training, evaluation, rubric | Experiments, accuracy curves |
| IoT/Backend lead | MQTT gateway, REST/SSE, storage | Uptime, latency measurements |
| Frontend/Docs lead | Dashboard, proposal, exhibition pack | UI tests, doc revisions |

## 8. Exhibition demo script (3 minutes)

1. Power station → `self_test.py` green on OLED.
2. Show calibration certificate printout (doc 05).
3. Place **good** piece → PASS (green LED), dashboard row green.
4. Place **defective** piece (stain/hole sample) → FAIL (red + buzzer), row red with class + confidence.
5. Change threshold slider 0.50 → 0.90 in dashboard → watch borderline piece flip PASS↔FAIL (**output changes with input**).
6. Show `evaluation_report.md`: accuracy ≥ 80% with confusion matrix.
7. Hand over logbooks + dataset + rubric.

## 9. Expected outcomes

- Prototype node meeting all six DRs with documented evidence.
- Open dataset (synthetic seed + real captures) and transparent ML rubric.
- Reusable pattern for other cutting rooms / product lines (Line A & Line B).
- Full documentation pack for school-board and exhibition judges.
