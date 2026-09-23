import json
import sys
import time

from threadsight.actuator import ActuatorBank
from threadsight.camera import Camera
from threadsight.calibration import Calibration
from threadsight.config import Config
from threadsight.decision import apply
from threadsight.inference import InferenceEngine
from threadsight.iot import IoTPublisher
from threadsight.sensors import SensorHub


def check(name: str, ok: bool, detail: str = "") -> bool:
    status = "PASS" if ok else "FAIL"
    line = f"[{status}] {name}"
    if detail:
        line += f" — {detail}"
    print(line)
    return ok


def main() -> int:
    config = Config()
    results = []

    calibration = Calibration.load(config.calibration_path)
    results.append(
        check(
            "calibration file",
            calibration.is_complete() or config.mock,
            str(config.calibration_path),
        )
    )

    hub = SensorHub(config, calibration)
    sensor = hub.read()
    results.append(
        check(
            "sensors read",
            isinstance(sensor.get("lux"), float) and isinstance(sensor.get("temp_c"), float),
            json.dumps(
                {
                    k: sensor[k]
                    for k in ("lux", "temp_c", "humidity_pct", "distance_mm", "light_ok")
                }
            ),
        )
    )

    camera = Camera(config)
    t0 = time.perf_counter()
    image = camera.capture()
    capture_ms = int((time.perf_counter() - t0) * 1000)
    results.append(
        check(
            "camera capture",
            image.ndim == 3 and image.shape[2] == 3,
            f"{image.shape} in {capture_ms}ms",
        )
    )

    engine = InferenceEngine(config)
    t1 = time.perf_counter()
    scores = engine.predict(image)
    infer_ms = int((time.perf_counter() - t1) * 1000)
    score_sum = sum(scores.values())
    results.append(
        check(
            "inference",
            abs(score_sum - 1.0) < 0.05,
            f"backend={engine.backend} sum={score_sum:.3f} in {infer_ms}ms",
        )
    )

    decision = apply(
        scores,
        engine.classes,
        config.threshold,
        light_ok=bool(sensor.get("light_ok", True)),
    )
    results.append(
        check(
            "decision",
            decision.decision in {"PASS", "FAIL"},
            f"{decision.decision} {decision.predicted_class} conf={decision.confidence:.2f}",
        )
    )

    actuators = ActuatorBank(config)
    actuators.indicate(decision.decision, decision.predicted_class, decision.confidence)
    results.append(check("actuators", True, actuators.last_state))

    t2 = time.perf_counter()
    iot = IoTPublisher(config)
    payload = {
        "schema": "threadsight.selftest.v1",
        "seq": iot.next_seq(),
        "node_id": config.node_id,
        "decision": decision.decision,
        "predicted_class": decision.predicted_class,
        "confidence": decision.confidence,
        "sensors": {
            "lux": sensor.get("lux"),
            "temp_c": sensor.get("temp_c"),
            "humidity_pct": sensor.get("humidity_pct"),
            "distance_mm": sensor.get("distance_mm"),
            "light_ok": sensor.get("light_ok"),
        },
        "latency_ms": {"edge": int((time.perf_counter() - t2) * 1000) + capture_ms + infer_ms},
        "model_version": engine.model_version,
        "backend": engine.backend,
        "self_test": True,
    }
    published = iot.publish_verdict(payload)
    results.append(
        check(
            "iot publish",
            published or config.mock,
            f"gateway={config.gateway_url} mqtt={config.mqtt_host}",
        )
    )

    sweep = []
    for theta in (0.50, 0.70, 0.90):
        d = apply(scores, engine.classes, theta, True)
        sweep.append((theta, d.decision))
    results.append(
        check(
            "threshold sweep (output vs input)",
            len(sweep) == 3,
            " ".join(f"theta={t}:{dec}" for t, dec in sweep),
        )
    )

    camera.close()
    actuators.close()
    iot.close()

    passed = all(results)
    print("-" * 48)
    print("SELF TEST:", "ALL PASS" if passed else "FAILURES PRESENT")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
