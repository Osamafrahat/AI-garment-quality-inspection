# 02 — Design Requirements Matrix

Challenge rule: **at least four measurable requirements, including response time and system accuracy**, plus **two additional measurable requirements** chosen for the application.

## 1. Mandatory four (includes response time + accuracy)

### DR-01 — System accuracy (AI classification)
| Field | Value |
|---|---|
| Statement | The AI model shall correctly classify fabric-piece quality state and defect type. |
| Metric | Accuracy = correct predictions / total predictions on the **held-out test set** (stratified 15%). |
| Target | **≥ 85%** target; **≥ 80%** hard challenge floor (evidence artifact required). |
| Method | `ml/evaluate.py` → `ml/artifacts/evaluation_report.md`, confusion matrix, per-class precision/recall. |
| Verification | Run evaluate on test split never seen in training; attach report to exhibition pack. |

### DR-02 — Response time
| Field | Value |
|---|---|
| Statement | From camera trigger to local actuator indication, and from verdict publish to dashboard update. |
| Metric | (a) Edge latency \(T_edge\) = t(actuator) − t(capture); (b) End-to-end \(T_e2e\) = t(dashboard row) − t(capture). |
| Target | \(T_edge\) **≤ 800 ms**; \(T_e2e\) **≤ 3000 ms**. |
| Method | Timestamps in firmware (`capture_ts`, `verdict_ts`, `actuate_ts`); gateway stores `received_at`; dashboard displays age. |
| Verification | 30-run latency sample; report p50/p95 (doc 06 §3). |

### DR-03 — Defect detection rate (sensitivity)
| Field | Value |
|---|---|
| Statement | Defective pieces shall be flagged (non-`ok` prediction or confidence rule → FAIL). |
| Metric | Recall on defective classes = TP_defect / (TP_defect + FN_defect). |
| Target | **≥ 90%**. |
| Method | Derived from confusion matrix in evaluation report. |
| Verification | Aggregate 5 defect classes as “positive”; `ok` as “negative”. |

### DR-04 — False reject rate
| Field | Value |
|---|---|
| Statement | Good pieces shall not be rejected unnecessarily (yield protection). |
| Metric | FRR = false FAIL on truly-`ok` test samples / all `ok` test samples. |
| Target | **≤ 5%** (equivalently specificity ≥ 95% at operating threshold). |
| Method | Threshold selected on validation set; frozen before test evaluation. |
| Verification | Reported alongside DR-01/DR-03 in same report. |

## 2. Two additional application-specific requirements

### DR-05 — Inspection throughput (chosen: industrial line rate)
| Field | Value |
|---|---|
| Statement | The station shall sustain continuous inspection of pieces presented on the line. |
| Metric | Completed capture→verdict cycles per minute, averaged over 2 minutes in demo mode. |
| Target | **≥ 12 pieces/min** (≥ 1 piece / 5 s including settle time). |
| Method | `firmware` cycle timer; gateway counts events; doc 06 §3.4. |
| Verification | Throughput report from 2-minute run; must also satisfy DR-02. |

### DR-06 — IoT telemetry reliability (chosen: communication with data sources)
| Field | Value |
|---|---|
| Statement | Verdicts and telemetry shall reach the gateway/dashboard reliably over the network. |
| Metric | Delivery ratio = messages received ≤ 3 s after publish / messages published (1000-message soak test). |
| Target | **≥ 99%**. |
| Method | Sequence numbers in MQTT/REST payloads; gateway gap report (`simulate.py --soak`). |
| Verification | Soak-test log attached to exhibition pack. |

## 3. Traceability summary

| ID | Category | Measurable | Required by challenge |
|---|---|---|---|
| DR-01 | Accuracy | % | ✅ mandatory |
| DR-02 | Response time | ms | ✅ mandatory |
| DR-03 | Detection rate | % | ✅ mandatory (4th core) |
| DR-04 | False reject | % | ✅ mandatory (4th core) |
| DR-05 | Throughput | pcs/min | ➕ chosen #1 |
| DR-06 | IoT reliability | % | ➕ chosen #2 |

## 4. Operating conditions (environmental envelope)

| Parameter | Range | Notes |
|---|---|---|
| Supply | 5 V / 3 A (Pi 5) via PSU or 20 000 mAh power bank | Portable on exhibition day |
| Illumination at piece | 300–800 lux (guard-band DR check) | Outside band → `LIGHT_OUT_OF_BAND` warning state |
| Temperature | 10–40 °C | BME280 monitored |
| Humidity | 20–80 % RH | BME280 monitored |
| Piece distance (ToF) | 40–120 mm triggers capture | Presence detection |

## 5. Definition of PASS / FAIL

```
FAIL  if predicted_class != "ok"
       OR confidence < decision_threshold (default 0.70, operator-adjustable 0.50–0.95)
       OR light out of guard-band (quality-risk override, flagged separately)
else PASS
```

Threshold is an **explicit input** used in the required “output changes with input” demonstration (doc 06 §4.1).
