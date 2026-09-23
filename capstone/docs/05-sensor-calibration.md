# 05 — Sensor Calibration

Challenge requirement: **conduct and document sensor calibration.**  
Executable tool: `firmware/calibrate.py` (writes `firmware/calibration/calibration.json`).  
Reference instruments are **lab equipment — used in the lab, never removed** (constraint compliance).

## 1. Calibration schedule

| When | Action |
|---|---|
| Before first use | Full calibration (all sensors) |
| Weekly during project | Quick check (lux + ToF 2-point) |
| Exhibition morning | Quick check + camera white-balance confirm |
| After any wiring change | Affected sensor only |

## 2. BH1750 illuminance (lux)

**Why:** DR guard-band (300–800 lux) and repeatability of AI input.

| Step | Procedure | Record |
|---|---|---|
| P1 | Lens cap / black foam over sensor → wait 10 s | raw₁ (expect ≈ 0) |
| P2 | Place next to **lab lux meter** under light tunnel, same plane | raw₂, ref₂ (lux) |
| P3 | Optional P3: second point at ~50 % dimmer (PWM or second tunnel setting) | raw₃, ref₃ |

**Model:** linear `lux = a·raw + b` least-squares fit (1-point forces b; 2-point full line).  
**Tolerance:** |device − ref| ≤ **±5 % of reading** or ±10 lux (whichever larger) at check points.  
**Certificate fields:** date, operator, a, b, max error, pass/fail.

## 3. BME280 temperature & humidity

| Channel | Reference | Method | Tolerance |
|---|---|---|---|
| Temperature | Lab precision thermometer | (a) Ice-water bath ~0 °C, (b) ambient ~25 °C, (c) body-temp water ~35 °C | ± 0.5 °C after offset |
| Humidity | Lab RH meter / saturated salt chamber | Two-point: ~33 % RH (MgCl₂) and ~75 % RH (NaCl) | ± 3 % RH |

Apply stored offsets: `temp_c = raw + ΔT`, `humidity_pct = clamp(raw + ΔRH)`.

## 4. VL53L0X time-of-flight distance

| Steps | Tape/ruler targets in lab: 50, 100, 150, 200 mm (sensor perpendicular to matte target) |
| Model | `mm = a·raw + b` |
| Tolerance | ≤ ±2 mm error at each check point |
| Role | Presence trigger window 40–120 mm (DR capture gating) |

## 5. Camera (Pi Camera Module 3)

| Item | Procedure |
|---|---|
| Focus/fixed geometry | Fixed focus lens; lock focus ring; torque marks |
| White balance | 18 % gray card fills frame under tunnel LEDs → save `wb_gains.r/g/b` |
| Exposure lock | Fixed exposure/gain profile `exposure_profile.json` so lux changes don't silently alter images |
| Resolution | 1600×1200 capture → center-crop/resize 224×224 for model |

Camera “calibration” = geometric + photometric consistency, not pixel metrology.

## 6. Actuator checks (functional calibration)

| Actuator | Check | Expect |
|---|---|---|
| RGB LED | Script `calibrate.py --actuators` | green on PASS, red on FAIL |
| Buzzer | Same | 2 short beeps on FAIL |
| Relay | Same (listen for click; LED indicator) | energizes only on FAIL pulse 500 ms |

## 7. Record template (auto-written to JSON + printable)

```json
{
  "calibrated_at": "2026-09-23T08:30:00Z",
  "operator": "STUDENT_NAME",
  "sensors": {
    "bh1750": {"a": 1.18, "b": -3.2, "points": [[120, 100.0], [480, 402.0]],
               "max_err_pct": 2.1, "pass": true},
    "bme280": {"delta_t_c": -0.3, "delta_rh": 1.2, "pass": true},
    "vl53l0x": {"a": 1.002, "b": -0.8, "max_err_mm": 1.4, "pass": true},
    "camera": {"wb_gains": [1.6, 1.0, 1.4], "exposure_profile": "locked_v1", "pass": true}
  },
  "lab_references_used": ["lux meter LM-20", "thermometer T-100", "RH meter RH-5", "steel rule"],
  "lab_equipment_removed": false
}
```

## 8. Acceptance

All `pass: true` required before accuracy testing (DR-01 runs only on a calibrated station). Failing sensor → block inspection (`SENSOR_NOT_CALIBRATED` state on OLED).
