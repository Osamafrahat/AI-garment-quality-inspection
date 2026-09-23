import random
import time

from .calibration import Calibration
from .config import Config


class SensorHub:
    def __init__(self, config: Config, calibration: Calibration) -> None:
        self.config = config
        self.calibration = calibration
        self._bus = None
        self._mock = config.mock
        if not self._mock:
            try:
                from smbus2 import SMBus

                self._bus = SMBus(1)
            except Exception:
                self._mock = True

    def _read_bh1750_raw(self) -> float:
        if self._bus is None:
            return 420.0 + random.uniform(-40, 60)
        addr = 0x23
        self._bus.write_byte(addr, 0x10)
        time.sleep(0.18)
        data = self._bus.read_i2c_block_data(addr, 0x00, 2)
        return ((data[0] << 8) | data[1]) / 1.2

    def _read_bme280_raw(self) -> tuple[float, float]:
        if self._bus is None:
            return (
                24.5 + random.uniform(-0.5, 0.5),
                42.0 + random.uniform(-3, 3),
            )
        try:
            import bme280

            address = 0x76
            calibration_params = bme280.load_calibration_params(self._bus, address)
            data = bme280.sample(self._bus, address, calibration_params)
            return float(data.temperature), float(data.humidity)
        except Exception:
            return (24.5, 42.0)

    def _read_vl53l0x_raw(self) -> float | None:
        if self._bus is None:
            if random.random() < 0.35:
                return None
            return 78.0 + random.uniform(-8, 10)
        try:
            import VL53L0X

            tof = VL53L0X.VL53L0X(i2c_bus=self._bus)
            tof.start_ranging(1)
            distance = tof.get_distance()
            tof.stop_ranging()
            return float(distance)
        except Exception:
            return None

    def read(self) -> dict:
        raw_lux = self._read_bh1750_raw()
        raw_t, raw_rh = self._read_bme280_raw()
        raw_mm = self._read_vl53l0x_raw()

        lux = self.calibration.lux(raw_lux)
        temp_c = self.calibration.temp_c(raw_t)
        humidity = self.calibration.humidity_pct(raw_rh)
        distance_mm = None if raw_mm is None else self.calibration.distance_mm(raw_mm)

        light_ok = self.config.lux_min <= lux <= self.config.lux_max
        presence = (
            distance_mm is not None
            and self.config.tof_min_mm <= distance_mm <= self.config.tof_max_mm
        )
        return {
            "lux": round(lux, 1),
            "temp_c": round(temp_c, 2),
            "humidity_pct": round(humidity, 1),
            "distance_mm": None if distance_mm is None else round(distance_mm, 1),
            "light_ok": bool(light_ok),
            "presence": bool(presence),
            "raw": {"lux": raw_lux, "temp_c": raw_t, "humidity_pct": raw_rh, "mm": raw_mm},
        }
