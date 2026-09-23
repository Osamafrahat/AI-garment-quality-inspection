import json
from pathlib import Path

import numpy as np


class Calibration:
    def __init__(self, data: dict | None = None) -> None:
        self.data = data or {}

    @classmethod
    def load(cls, path: Path) -> "Calibration":
        if path.is_file():
            return cls(json.loads(path.read_text(encoding="utf-8")))
        return cls({})

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def is_complete(self) -> bool:
        sensors = self.data.get("sensors", {})
        needed = ("bh1750", "bme280", "vl53l0x", "camera")
        return all(sensors.get(k, {}).get("pass") for k in needed)

    def lux(self, raw: float) -> float:
        bh = self.data.get("sensors", {}).get("bh1750", {})
        a = float(bh.get("a", 1.0))
        b = float(bh.get("b", 0.0))
        return a * raw + b

    def temp_c(self, raw: float) -> float:
        bme = self.data.get("sensors", {}).get("bme280", {})
        return raw + float(bme.get("delta_t_c", 0.0))

    def humidity_pct(self, raw: float) -> float:
        bme = self.data.get("sensors", {}).get("bme280", {})
        val = raw + float(bme.get("delta_rh", 0.0))
        return float(np.clip(val, 0.0, 100.0))

    def distance_mm(self, raw: float) -> float:
        tof = self.data.get("sensors", {}).get("vl53l0x", {})
        a = float(tof.get("a", 1.0))
        b = float(tof.get("b", 0.0))
        return a * raw + b
