import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = ROOT.parent / "ml" / "artifacts"
DEFAULT_CALIBRATION = ROOT / "calibration" / "calibration.json"


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    def __init__(self) -> None:
        self.node_id = os.environ.get("TS_NODE_ID", "ts-node-01")
        self.mock = env_bool("TS_MOCK", False)
        self.gateway_url = os.environ.get("TS_GATEWAY_URL", "http://localhost:8000")
        self.mqtt_host = os.environ.get("TS_MQTT_HOST", "localhost")
        self.mqtt_port = int(os.environ.get("TS_MQTT_PORT", "1883"))
        self.mqtt_enabled = env_bool("TS_MQTT", True)
        self.rest_enabled = env_bool("TS_REST", True)
        self.artifacts_dir = Path(os.environ.get("TS_MODEL_DIR", str(DEFAULT_MODEL)))
        self.calibration_path = Path(
            os.environ.get("TS_CALIBRATION", str(DEFAULT_CALIBRATION))
        )
        self.threshold = float(os.environ.get("TS_THRESHOLD", "0.70"))
        self.lux_min = float(os.environ.get("TS_LUX_MIN", "300"))
        self.lux_max = float(os.environ.get("TS_LUX_MAX", "800"))
        self.tof_min_mm = float(os.environ.get("TS_TOF_MIN_MM", "40"))
        self.tof_max_mm = float(os.environ.get("TS_TOF_MAX_MM", "120"))
        self.cycle_period_s = float(os.environ.get("TS_CYCLE_S", "0.5"))
        self.image_size = int(os.environ.get("TS_IMAGE_SIZE", "128"))
        self.telemetry_period_s = float(os.environ.get("TS_TELEMETRY_S", "5"))
