# 07 — Exhibition Rubric (Team Self-Assessment + Judge Sheet)

## A. Design & requirements (25 pts)

| Criterion | Excellent (5) | Good (3–4) | Poor (0–2) | Score |
|---|---|---|---|---|
| Pathway fit & problem clarity | Industrial QA problem precisely stated; solution matches | Adequate | Vague / mismatched | |
| ≥4 core measurable requirements + 2 chosen | 6 well-formed, testable DRs with units & methods | Some missing units/methods | Few or non-measurable | |
| Response time & accuracy explicitly defined | Both present with targets & measurement method | One weak | Missing | |
| Output↔input demonstration | ≥3 scripted demos executed live (doc 06 §4) | 1–2 demos | None | |

## B. Hardware & sensing (20 pts)

| Criterion | Excellent | Good | Poor | Score |
|---|---|---|---|---|
| Hardware beyond Arduino | Advanced controller (Pi 5) + ≥3 sensor types + actuators | Partial | Arduino / no HW | |
| Sensor calibration | Documented procedure + JSON + certificate; tolerances met | Partial docs | No calibration | |
| Build quality / portability | Secure, tidy, battery-ready, boots unattended | Works but fragile | Lab-only mess | |

## C. AI / ML (25 pts)

| Criterion | Excellent | Good | Poor | Score |
|---|---|---|---|---|
| Accuracy evidence ≥ 80 % | Report with confusion matrix, predictions, seed | Accuracy only | Missing or <80 % | |
| Dataset & rubric at exhibition | Dataset card + rubric + splits + labels | Dataset only | Missing | |
| Model quality vs DR targets | ≥85 % accuracy, ≥90 % recall, ≤5 % FRR | Meets floor 80 % | Below floor | |
| Error analysis | Confusion pairs discussed + next iteration plan | Brief | None | |

## D. ICT / IoT / communication (15 pts)

| Criterion | Excellent | Good | Poor | Score |
|---|---|---|---|---|
| IoT transport | MQTT + REST dual path, seq numbers, soak ≥99 % | One path working | No telemetry | |
| Dashboard | Live rows, KPIs, threshold control, latency age | Static list | None | |
| Data-source integration | Cut schedule (Line A/B) attached to verdicts | Partial context | Isolated device | |

## E. Documentation & team process (15 pts)

| Criterion | Excellent | Good | Poor | Score |
|---|---|---|---|---|
| Logbooks (hard copy / member) | Daily entries, calib data, experiments, decisions | Sparse | Missing | |
| Test plan executed | DR table filled with real numbers | Partial | Untested | |
| Exhibition readiness | Self-test green, demo script rehearsed, backups on USB | Mostly ready | Unprepared | |

**Total: ___ / 100**

| Band | Score |
|---|---|
| Excellent | 90–100 |
| Good | 75–89 |
| Acceptable | 60–74 |
| Fail | < 60 |

## F. ML-only rubric (handed with dataset — scores model, not booth)

See `capstone/ml/rubric.md` (accuracy bands + evidence completeness).

## G. Judge quick-script (5 minutes)

1. Read DR matrix (doc 02) — units visible?  
2. Run/inspect `evaluation_report.md` — accuracy ≥ 80 %?  
3. Live threshold demo — does output flip?  
4. Calibration certificate — pass tolerances?  
5. Open logbook — dated entries?  
6. Pull plug on Wi-Fi — does edge still indicate PASS/FAIL? (resilience)
