# 03 — System Architecture & Schematic

## 1. High-level architecture

```
                         ┌───────────────────────────────────────────────┐
                         │           EXHIBITION / FACTORY LAN            │
                         │                                               │
 ┌─────────────────────┐ │  MQTT          REST           SSE             │
 │  INSPECTION NODE    │ │ topics         POST/GET       events          │
 │  (Raspberry Pi 5)   │ │   │               │             │             │
 │                     │ ▼               ▼             ▼             │
 │  ┌───────────────┐  │ │ ┌─────────────────────────────────────┐       │
 │  │ Pi Camera M3  │──┼─┼─▶                                     │       │
 │  └───────────────┘  │ │ │        GATEWAY (laptop / Pi)        │       │
 │  ┌───────────────┐  │ │ │        FastAPI + SQLite             │       │
 │  │ BH1750  lux   │──┼─┼─▶  • ingest inspections              │       │
 │  │ BME280 T/RH   │  │ │ │  • telemetry store                 │       │
 │  │ VL53L0X ToF   │──┼─┼─▶  • REST /api/v1/*                  │       │
 │  └───────────────┘  │ │ │  • SSE /api/v1/stream               │       │
 │  ┌───────────────┐  │ │ └──────────────┬──────────────────────┘       │
 │  │ AI runtime    │  │ │                │ SSE                          │
 │  │ TFLite/ONNX   │  │ │                ▼                              │
 │  └───────────────┘  │ │ ┌─────────────────────────────────────┐       │
 │  ┌───────────────┐  │ │ │  DASHBOARD (Next.js /inspection)    │       │
 │  │ OLED LED      │  │ │ │  live verdicts • threshold slider   │       │
 │  │ buzzer relay  │  │ │ │  latency • defect mix • cut context  │       │
 │  └───────────────┘  │ │ └─────────────────────────────────────┘       │
 └─────────────────────┘ │                                               │
                         │   DATA SOURCES                                │
                         │   • Cut schedule API (Line A / Line B cuts)   │
                         │   • NTP time sync  • (optional) weather feed  │
                         └───────────────────────────────────────────────┘
```

## 2. Edge node block schematic (hardware)

```
                 5V/3A PSU ──┬── Raspberry Pi 5 ──┬── microSD (model + logs)
                             │                    │
                             │   I2C bus (GPIO2/3)│
                             │      ├── BH1750 lux sensor
                             │      ├── BME280  temp/humidity
                             │      ├── VL53L0X ToF distance
                             │      └── SSD1306 OLED 128x64
                             │
                             │   CSI-2 ribbon
                             │      └── Pi Camera Module 3
                             │            └── aimed into LED light tunnel
                             │
                             │   GPIO (through 330Ω / level-safe 5V modules)
                             │      ├── GPIO17 → RGB LED (PASS green / FAIL red)
                             │      ├── GPIO27 → piezo buzzer (FAIL beep)
                             │      ├── GPIO22 → relay IN (reject gate solenoid, dry contact)
                             │      └── GPIO23 → push-button (manual trigger / ack)
                             │
                             └── Wi-Fi ──▶ gateway MQTT :1883 / REST :8000
```

**Light tunnel:** small enclosure with 6500 K LED strip + diffuser so lux is controlled; BH1750 sits beside the piece looking at the same plane.

**Safety:** all user-accessible circuits ≤ 5 V DC; relay switches an external low-voltage indicator/solenoid only (industrial pathway, no medical constraints apply).

## 3. Software architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Edge OS | Raspberry Pi OS (64-bit) | boot, systemd service `threadsight` |
| Edge app | Python 3.11+ package `threadsight` | capture, sensors, inference, decision, actuate, publish |
| AI runtime | TFLite (preferred) / ONNX Runtime / sklearn fallback | local model execution |
| Transport | MQTT 3.1.1 (paho) + HTTP POST fallback | verdicts, telemetry, schedule sync |
| Gateway | Python FastAPI + SQLite + SSE | persistence, REST, live stream, soak metrics |
| Dashboard | Next.js (monorepo `apps/web`) | operator UI, threshold input, KPI cards |
| Schedule source | REST JSON generated from cut workbook | Cut #, product line, planned sizes |

### Module boundaries (edge)

```
threadsight/
├── config.py        # env-driven config (MQTT host, threshold, mock flags)
├── camera.py        # PiCamera2 / OpenCV / mock image source
├── sensors.py       # I2C drivers + mock sensors + guard-band logic
├── calibration.py   # load/save calibration JSON, apply corrections
├── inference.py     # TFLite | ONNX | sklearn model adapter (same API)
├── decision.py      # PASS/FAIL rules (threshold, light band, class)
├── actuator.py      # OLED, RGB, buzzer, relay (GPIO or mock)
├── iot.py           # MQTT client + REST publisher with seq numbers
└── main.py          # orchestration loop + latency timestamps
```

**Dependency rule:** `main.py` composes modules; modules do not import each other except via `config`/`decision` pure functions (testable without hardware).

## 4. Data contracts

### 4.1 Verdict payload (MQTT `threadsight/node/{id}/verdict` and REST `POST /api/v1/inspections`)

```json
{
  "schema": "threadsight.verdict.v1",
  "seq": 1042,
  "node_id": "ts-node-01",
  "capture_ts": "2026-09-23T10:15:04.123Z",
  "verdict_ts": "2026-09-23T10:15:04.480Z",
  "decision": "PASS",
  "predicted_class": "ok",
  "confidence": 0.93,
  "threshold": 0.70,
  "scores": {"ok": 0.93, "hole": 0.02, "stain": 0.03, "broken_thread": 0.01,
             "shade_variation": 0.01, "print_misalignment": 0.00},
  "cut_no": 6,
  "product_line": "Line A — T-Shirt",
  "sensors": {
    "lux": 512.4,
    "temp_c": 24.6,
    "humidity_pct": 41.0,
    "distance_mm": 78.2,
    "light_ok": true
  },
  "latency_ms": {"edge": 412, "e2e_est": null},
  "model_version": "mbv2-ts-v1"
}
```

### 4.2 Telemetry (MQTT `threadsight/node/{id}/telemetry`, every 5 s)

```json
{ "schema": "threadsight.telemetry.v1", "seq": 9001, "node_id": "ts-node-01",
  "uptime_s": 3600, "lux": 510.1, "temp_c": 24.5, "humidity_pct": 41.2,
  "distance_mm": null, "queue_depth": 0, "model_loaded": true }
```

### 4.3 Schedule down-link (MQTT `threadsight/schedule/active`)

```json
{ "schema": "threadsight.schedule.v1", "cut_no": 6,
  "product_line": "Line A — T-Shirt", "cut_date": "2026-08-06",
  "planned_pieces": 560 }
```

### 4.4 Gateway REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | liveness + model/seq stats |
| POST | `/api/v1/inspections` | ingest verdict (edge) |
| GET | `/api/v1/inspections?limit&decision` | list for dashboard |
| GET | `/api/v1/stats` | KPI aggregates (accuracy ops, p95 latency, defect mix) |
| GET | `/api/v1/stream` | SSE live events |
| POST | `/api/v1/threshold` | operator threshold broadcast |
| POST | `/api/v1/simulate` | exhibition/demo generator |
| GET | `/api/v1/schedule/active` | current cut context |

## 5. Sequence — one inspection cycle

```
ToF detects piece (40–120 mm)
   │  t0 capture_ts
   ▼
camera.capture() ──► pre-process (resize 224², normalize)
   │
   ▼
sensors.read()  (parallel-friendly; lux guard-band)
   │
   ▼
inference.predict(image) ──► scores[6]
   │  t1 verdict_ts
   ▼
decision.apply(scores, threshold, light_ok) ──► PASS|FAIL
   │
   ├──► actuator.indicate()  (OLED/LED/buzzer/relay)   t2  ⇒ T_edge = t2−t0 ≤ 800 ms
   │
   └──► iot.publish(verdict) ──► gateway persist ──► SSE ──► dashboard row
                                                        t3  ⇒ T_e2e = t3−t0 ≤ 3000 ms
```

## 6. AI platform placement

- **Training:** workstation/offline (`ml/train.py`) → `model.tflite` / `model.onnx` + `labels.json`.
- **Inference:** on-device edge (privacy + latency); no cloud inference required for DR-02.
- **Evidence:** offline `evaluate.py` produces the accuracy artifact judges require.
- **Update path:** copy model file to `firmware/models/`, bump `model_version`; systemd restarts service.

## 7. ICT platform placement

- Dashboard (Next.js), REST, SSE, structured JSON logs, SQLite/PostgreSQL-ready schema, exhibition dataset + rubric documents, logbooks.

## 8. Portability & exhibition day

| Item | Strategy |
|---|---|
| Power | 5 V PSU or power bank; boots to service automatically |
| Network | Phone hotspot / local AP; gateway + dashboard on same LAN; offline demo via `TS_MOCK` + `simulate.py` |
| Storage | SQLite file on gateway laptop; model + calibration JSON on SD card |
| Size | Light tunnel ~ 25×25×30 cm; whole kit in one case |
| Reliability | `self_test.py` pre-show; systemd `Restart=always`; MQTT QoS 1 + REST retry |

## 9. Stack decisions (ADR-style)

| Decision | Choice | Alternatives rejected |
|---|---|---|
| Controller | Raspberry Pi 5 | Arduino (forbidden), STM32-only (no camera/AI ease), Jetson (cost) |
| Edge language | Python | C++ (slower iteration), JS (weaker camera/I2C ecosystem) |
| Model format | TFLite → ONNX fallback → sklearn fallback | Full PyTorch on device (heavy) |
| Transport | MQTT + REST dual-path | REST-only (no broker semantics), raw TCP (no ecosystem) |
| Gateway DB | SQLite | Postgres (overkill for portable demo; schema kept portable) |
| Dashboard | Existing monorepo Next.js | Separate static HTML (less integrated with team stack) |
