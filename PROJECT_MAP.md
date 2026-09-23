# PROJECT_MAP.md — ThreadSight (AI garment quality inspection)

**Generated:** 2026-09-23  
**Architecture:** Edge firmware → FastAPI gateway → Next.js dashboard  
**Stack baseline:** Python 3.14 / Raspberry Pi 5 · FastAPI · Next.js 15 · pnpm 9

---

## [TECH_STACK]

| Layer | Technology | Notes |
|-------|------------|-------|
| Edge | Raspberry Pi 5 + Python firmware | `capstone/firmware/threadsight` |
| Sensors | Lux / temp / humidity / distance + camera | Calibration in `capstone/firmware/calibrate.py` |
| ML | sklearn model + dataset | `capstone/ml` · accuracy 0.90 |
| Gateway | FastAPI + SQLite | `capstone/gateway/main.py` · `:8000` |
| Dashboard | Next.js 15 App Router | `apps/web` · `/inspection` · `:3000` |
| Docs | Capstone set 01–08 | `capstone/docs/` |

---

## [SYSTEM_FLOW]

```
Camera / Sensors (Pi 5)
        │
        v
Firmware inference + decision (θ)
        │  HTTP POST inspection
        v
FastAPI gateway (:8000)
  /api/v1/inspections · stats · threshold · stream · simulate
        │  REST + SSE
        v
Next.js dashboard (:3000/inspection)
  KPI cards · θ slider · live verdicts · defect mix
```

### Verifiable goals (exhibition)
1. Accuracy ≥ 80% on held-out data (achieved: 90%)
2. Edge response time p95 within requirement
3. Input change → output change via θ slider or Demo PASS/FAIL
4. Live telemetry visible without restart

---

## [DIRECTORIES]

```
threadsight/
  capstone/
    docs/           # 01 proposal … 08 logbook
    firmware/       # Pi self-test, sensors, inference, IoT uplink
    gateway/        # FastAPI service + simulator
    ml/             # dataset, train/evaluate, artifacts
    README.md
    exhibition_boot.bat
  apps/
    web/            # Next.js inspection dashboard
    mobile/         # Optional Expo staff shell
  packages/
    core/ db/ auth/ billing/ api-contracts/ messaging/
  ARCHITECTURE.md
  PROJECT_MAP.md
```

---

## [RUN]

```powershell
# Gateway
python capstone/gateway/main.py

# Dashboard
& "$env:APPDATA\npm\pnpm.cmd" install --ignore-scripts
& "$env:APPDATA\npm\pnpm.cmd" --filter @threadsight/web dev

# Demo stream
python capstone/gateway/simulate.py --count 5
```

Open: `http://localhost:3000/inspection` · Gateway health: `http://localhost:8000/api/v1/health`

---

## [GIT]

Remote: `https://github.com/Osamafrahat/AI-garment-quality-inspection.git` · branch `main`
