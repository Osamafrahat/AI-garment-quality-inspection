# ThreadSight — AI Garment Quality Inspection Station

**Capstone Pathway:** A. Industrial Base — Product quality inspection and control  
**Challenge fit:** Fully automated / AI-assisted production line quality control with sensing, measurement, ICT, IoT, and AI.

ThreadSight is a portable, edge-AI inspection node that photographs fabric pieces on a garment cutting line, classifies defects with a deep-learning model (≥ 80% accuracy evidence required), measures ambient/lighting conditions with calibrated sensors, indicates PASS/FAIL locally, and streams results over MQTT/REST to a web dashboard for the production team.

---

## Repository layout

```
capstone/
├── README.md                  ← you are here (master index)
├── docs/                      ← exhibition documentation pack
│   ├── 01-project-proposal.md
│   ├── 02-design-requirements.md
│   ├── 03-system-architecture.md
│   ├── 04-ai-model-plan.md
│   ├── 05-sensor-calibration.md
│   ├── 06-test-plan.md
│   ├── 07-exhibition-rubric.md
│   └── 08-logbook-template.md
├── ml/                        ← dataset + training + accuracy evidence
│   ├── generate_dataset.py
│   ├── train.py
│   ├── evaluate.py
│   ├── rubric.md
│   ├── dataset_card.md
│   └── requirements.txt
├── firmware/                  ← Raspberry Pi 5 edge node (Python)
│   ├── threadsight/           ← package (camera, sensors, AI, IoT, actuators)
│   ├── calibrate.py
│   ├── self_test.py
│   └── requirements.txt
└── gateway/                   ← local IoT gateway (FastAPI + SQLite + SSE)
    ├── main.py
    ├── simulate.py
    └── requirements.txt
```

The exhibition **dashboard** lives in the monorepo web app: `apps/web/src/app/inspection/page.tsx`.

---

## Quick start (exhibition laptop)

```powershell
# 1) ML: build dataset, train, produce accuracy evidence
cd capstone\ml
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python generate_dataset.py
python train.py
python evaluate.py          # writes artifacts/evaluation_report.md (accuracy ≥ 80%)

# 2) Gateway (IoT hub + REST/SSE for dashboard)
cd ..\gateway
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py              # http://localhost:8000

# 3) Dashboard
# from repo root
pnpm dev                    # open http://localhost:3000/inspection

# 4) Edge node — on Raspberry Pi 5 (or PC mock mode)
cd ..\firmware
pip install -r requirements.txt
python self_test.py
$env:TS_MOCK="1"; python -m threadsight.main
```

Exhibition without hardware: `python gateway/simulate.py` streams synthetic live verdicts to the dashboard.

---

## Requirements mapping (summary)

| Challenge requirement | Where addressed |
|---|---|
| ≥ 4 measurable requirements incl. response time + accuracy (+2 chosen) | `docs/02-design-requirements.md` (DR-01…DR-06) |
| ICT + IoT + AI platforms | MQTT/REST/SSE + TFLite/ONNX AI + web ICT dashboard |
| Hardware components | Raspberry Pi 5, camera, 4 sensors, OLED, LED/buzzer/relay — `docs/03` |
| Dataset + ML rubric at exhibition | `ml/dataset/`, `ml/rubric.md`, `ml/dataset_card.md` |
| AI accuracy evidence ≥ 80% | `ml/artifacts/evaluation_report.md` from `evaluate.py` |
| Sensor calibration documented | `docs/05-sensor-calibration.md` + `firmware/calibrate.py` |
| Testable, operational, reliable, portable | `docs/06-test-plan.md` + `firmware/self_test.py` |
| No Arduino | Raspberry Pi 5 (advanced SoC controller) |
| Output changes with inputs | Threshold/defect/lighting input sweeps — `docs/06` §4 |
| Hard-copy logbooks | `docs/08-logbook-template.md` (one per member) |
