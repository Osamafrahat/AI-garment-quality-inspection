# 06 — Test Plan

Whole system (software + hardware) must be **testable**. Tests are layered so most run without hardware (`TS_MOCK=1`), and lab-only checks stay in the lab.

## 1. Unit / component tests

| ID | Component | Input | Expected output | How to run |
|---|---|---|---|---|
| T-U1 | `decision.apply` | scores, θ=0.7, light_ok | PASS/FAIL per rules | `python -m pytest capstone/firmware/tests` (or `self_test.py --unit`) |
| T-U2 | `decision.apply` θ sweep | same scores, θ 0.5→0.95 | monotonic FAIL pressure ↑ as θ↑ for borderline | included in self-test |
| T-U3 | `calibration.apply` | raw lux + (a,b) | corrected lux within tol | self-test |
| T-U4 | `inference` adapter | fixed 224² array | scores sum to 1 | self-test (model present) |
| T-U5 | Gateway API | POST verdict fixture | 201 + row in GET | `pytest capstone/gateway` or curl script |
| T-U6 | ML evaluate | test split | accuracy ≥ 0.80 else exit≠0 | `python ml/evaluate.py --min-accuracy 0.80` |

## 2. Integration tests

| ID | Scenario | Expected |
|---|---|---|
| T-I1 | Mock node → gateway → SSE | dashboard receives event ≤ 3 s (DR-06/DR-02 e2e) |
| T-I2 | REST-only path (MQTT down) | verdict still persisted (dual-path) |
| T-I3 | Schedule down-link change cut # | next verdict carries new `cut_no` / line |
| T-I4 | Threshold POST from dashboard | subsequent edge decisions use new θ |

## 3. System performance tests (exhibition evidence)

### 3.1 Accuracy (DR-01/03/04)
```powershell
cd capstone\ml
python evaluate.py --min-accuracy 0.80
# attach artifacts/evaluation_report.md
```

### 3.2 Response time (DR-02)
- 30 captures (mock or real); report p50/p95 of `latency_ms.edge` and dashboard-visible age.
- Pass: p95 edge ≤ 800 ms; p95 e2e ≤ 3000 ms.

### 3.3 Reliability soak (DR-06)
```powershell
python gateway\simulate.py --soak 1000 --gap-ms 200
# gateway reports: published=1000 received=… ratio≥0.99 seq gaps=[]
```

### 3.4 Throughput (DR-05)
2-minute continuous mock/real cycle; `pieces/min ≥ 12`.

## 4. Required demonstration: **system output changes as input changes**

Judges must see input→output causality. Four scripted demos:

### 4.1 Decision threshold θ (control input)
| Step | Action | Observed output |
|---|---|---|
| 1 | Feed borderline sample (confidence ≈ 0.72) with θ=0.70 | **PASS** |
| 2 | Dashboard slider θ → 0.85 | same image now **FAIL** (confidence < θ) |
| 3 | θ → 0.50 | PASS with margin |

Artifacts: side-by-side dashboard screenshots + verdict JSON `threshold` field.

### 4.2 Defect severity (physical input)
| Step | Input | Output |
|---|---|---|
| 1 | Severity 0.2 stain (faint) | confidence 0.55–0.75, may PASS at low θ |
| 2 | Severity 0.8 stain | confidence > 0.9 → FAIL, red LED + buzzer + relay click |

Use synthetic severity images or fabric swatches.

### 4.3 Presence distance (sensor input)
| Distance | Output |
|---|---|
| 200 mm (no piece) | no capture, OLED `WAITING` |
| 80 mm (in band) | capture cycle runs |

### 4.4 Illumination (environment input)
| Lux | Output |
|---|---|
| 500 (in band) | `light_ok=true`, normal verdict |
| 80 (tunnel off) | `light_ok=false`, warning flag `LIGHT_OUT_OF_BAND` on verdict + dashboard amber badge |

## 5. Hardware bring-up tests

| ID | Test | Pass criteria |
|---|---|---|
| T-H1 | `self_test.py` power-on | I2C devices found, camera opens, model loads, actuators respond |
| T-H2 | Calibration quick check | all sensors pass tolerances (doc 05) |
| T-H3 | 1-hour burn-in | no crash; systemd restart count = 0 |
| T-H4 | Portable power | runs ≥ 45 min on power bank |

## 6. Negative / fault injection

| Fault | Expected behavior |
|---|---|
| Gateway down | edge queues (QoS1/REST retry), resumes; `queue_depth` telemetry > 0 |
| Model file missing | OLED `MODEL_ERROR`, no false PASS |
| Camera disconnected | retries ×3 → `CAMERA_ERROR` state |
| Lux out of band | still inspects but flags warning (configurable strict mode fails closed) |

## 7. Lab-bound tests

Tests needing **lab reference instruments** (lux meter, thermometers, RH chamber) are executed in the lab per constraint; only ThreadSight's own BOM travels to the exhibition. Results copied into calibration JSON + printed certificate.

## 8. Exit criteria for exhibition day

- [ ] DR-01…DR-06 all measured with recorded numbers ≥ targets  
- [ ] `self_test.py` green  
- [ ] Calibration JSON `pass: true`  
- [ ] Demo 4.1–4.4 rehearsed  
- [ ] Logbooks printed per member (doc 08)  
- [ ] Dataset + rubric + evaluation report on USB + printed  
