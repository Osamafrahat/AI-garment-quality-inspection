import time
from datetime import datetime, timezone

import requests

from .actuator import ActuatorBank
from .camera import Camera
from .calibration import Calibration
from .config import Config
from .decision import apply
from .inference import InferenceEngine
from .iot import IoTPublisher, utc_now_iso
from .sensors import SensorHub


class ThreadSightNode:
    def __init__(self) -> None:
        self.config = Config()
        self.calibration = Calibration.load(self.config.calibration_path)
        self.sensors = SensorHub(self.config, self.calibration)
        self.camera = Camera(self.config)
        self.engine = InferenceEngine(self.config)
        self.actuators = ActuatorBank(self.config)
        self.iot = IoTPublisher(self.config)
        self.schedule = {
            "cut_no": None,
            "product_line": None,
            "planned_pieces": None,
        }
        self._last_telemetry = 0.0
        self._cycle = 0

    def refresh_schedule(self) -> None:
        try:
            resp = requests.get(
                f"{self.config.gateway_url.rstrip('/')}/api/v1/schedule/active",
                timeout=1.5,
            )
            if resp.ok:
                data = resp.json()
                self.schedule = {
                    "cut_no": data.get("cut_no"),
                    "product_line": data.get("product_line"),
                    "planned_pieces": data.get("planned_pieces"),
                }
        except Exception:
            pass

    def run_once(self) -> dict:
        t0 = time.perf_counter()
        capture_ts = utc_now_iso()
        sensor = self.sensors.read()
        if not sensor["presence"] and not self.config.mock:
            self.actuators.show_status("WAITING")
            return {"skipped": "no_presence"}

        image = self.camera.capture()
        scores = self.engine.predict(image)
        t1 = time.perf_counter()
        verdict_ts = utc_now_iso()

        result = apply(
            scores,
            self.engine.classes,
            self.config.threshold,
            light_ok=bool(sensor["light_ok"]),
        )
        self.actuators.indicate(
            result.decision, result.predicted_class, result.confidence
        )
        t2 = time.perf_counter()

        edge_ms = int((t2 - t0) * 1000)
        payload = {
            "schema": "threadsight.verdict.v1",
            "seq": self.iot.next_seq(),
            "node_id": self.config.node_id,
            "capture_ts": capture_ts,
            "verdict_ts": verdict_ts,
            "decision": result.decision,
            "predicted_class": result.predicted_class,
            "confidence": round(result.confidence, 4),
            "threshold": result.threshold,
            "scores": {k: round(v, 4) for k, v in scores.items()},
            "reasons": list(result.reasons),
            "cut_no": self.schedule.get("cut_no"),
            "product_line": self.schedule.get("product_line"),
            "sensors": {
                "lux": sensor["lux"],
                "temp_c": sensor["temp_c"],
                "humidity_pct": sensor["humidity_pct"],
                "distance_mm": sensor["distance_mm"],
                "light_ok": sensor["light_ok"],
            },
            "latency_ms": {"edge": edge_ms, "inference": int((t1 - t0) * 1000)},
            "model_version": self.engine.model_version,
            "backend": self.engine.backend,
        }
        self.iot.publish_verdict(payload)
        self._cycle += 1
        self._maybe_telemetry(sensor)
        return payload

    def _maybe_telemetry(self, sensor: dict) -> None:
        now = time.time()
        if now - self._last_telemetry < self.config.telemetry_period_s:
            return
        self._last_telemetry = now
        self.iot.publish_telemetry(
            {
                "schema": "threadsight.telemetry.v1",
                "seq": self.iot.next_seq(),
                "node_id": self.config.node_id,
                "ts": utc_now_iso(),
                "uptime_s": int(now - START_TIME),
                "lux": sensor["lux"],
                "temp_c": sensor["temp_c"],
                "humidity_pct": sensor["humidity_pct"],
                "distance_mm": sensor["distance_mm"],
                "queue_depth": self.iot.queue_depth(),
                "model_loaded": self.engine.backend != "heuristic",
                "cycles": self._cycle,
            }
        )

    def run_forever(self) -> None:
        self.refresh_schedule()
        print(
            f"ThreadSight node={self.config.node_id} mock={self.config.mock} "
            f"backend={self.engine.backend} threshold={self.config.threshold}"
        )
        if not self.calibration.is_complete() and not self.config.mock:
            print("WARNING: calibration incomplete — run calibrate.py")
            self.actuators.show_status("NOT_CALIBRATED")
        while True:
            try:
                out = self.run_once()
                if out.get("skipped") == "no_presence":
                    time.sleep(0.2)
                    continue
                print(
                    f"{out['decision']:4} {out['predicted_class']:18} "
                    f"conf={out['confidence']:.2f} edge={out['latency_ms']['edge']}ms "
                    f"lux={out['sensors']['lux']}"
                )
            except KeyboardInterrupt:
                break
            except Exception as exc:
                print(f"ERROR: {exc}")
                self.actuators.show_status("ERROR")
            time.sleep(self.config.cycle_period_s)
        self.shutdown()

    def shutdown(self) -> None:
        self.camera.close()
        self.actuators.close()
        self.iot.close()


START_TIME = time.time()


def main() -> None:
    node = ThreadSightNode()
    node.run_forever()


if __name__ == "__main__":
    main()
