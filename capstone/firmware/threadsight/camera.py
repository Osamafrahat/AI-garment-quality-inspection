import random
from pathlib import Path

import numpy as np
from PIL import Image

from .config import Config


class Camera:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.size = config.image_size
        self._mock = config.mock
        self._picam = None
        self._cv = None
        self._mock_pool = self._build_mock_pool()
        if not self._mock:
            try:
                from picamera2 import Picamera2

                self._picam = Picamera2()
                conf = self._picam.create_still_configuration(
                    main={"size": (1600, 1200)}
                )
                self._picam.configure(conf)
                self._picam.start()
            except Exception:
                try:
                    import cv2

                    self._cv = cv2.VideoCapture(0)
                    if not self._cv.isOpened():
                        raise RuntimeError("no camera")
                except Exception:
                    self._mock = True

    def _build_mock_pool(self) -> list[np.ndarray]:
        pool: list[np.ndarray] = []
        dataset = (
            self.config.artifacts_dir.parent
            / "dataset"
            / "test"
        )
        for cls_dir in sorted(dataset.glob("*")) if dataset.is_dir() else []:
            files = sorted(cls_dir.glob("*.png"))[:8]
            for f in files:
                img = Image.open(f).convert("RGB").resize(
                    (self.size, self.size), Image.BILINEAR
                )
                pool.append(np.asarray(img))
        if not pool:
            for i in range(12):
                base = 170 + (i * 7) % 50
                arr = np.full((self.size, self.size, 3), base, dtype=np.uint8)
                arr[::8] += 20
                arr[:, ::8] += 15
                pool.append(np.clip(arr, 0, 255).astype(np.uint8))
        return pool

    def capture(self) -> np.ndarray:
        if self._picam is not None:
            frame = self._picam.capture_array("main")
            img = Image.fromarray(frame[:, :, :3]).resize(
                (self.size, self.size), Image.BILINEAR
            )
            return np.asarray(img)
        if self._cv is not None:
            ok, frame = self._cv.read()
            if not ok:
                raise RuntimeError("camera read failed")
            img = Image.fromarray(frame[:, :, ::-1]).resize(
                (self.size, self.size), Image.BILINEAR
            )
            return np.asarray(img)
        return random.choice(self._mock_pool).copy()

    def close(self) -> None:
        if self._picam is not None:
            try:
                self._picam.stop()
                self._picam.close()
            except Exception:
                pass
        if self._cv is not None:
            self._cv.release()
