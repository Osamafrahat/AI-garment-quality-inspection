import time

from .config import Config


class ActuatorBank:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._mock = config.mock
        self.last_state = "BOOT"
        self._gpio = None
        self._oled = None
        if not self._mock:
            try:
                import gpiozero

                self._rgb_red = gpiozero.LED(17)
                self._rgb_green = gpiozero.LED(27)
                self._buzzer = gpiozero.Buzzer(22)
                self._relay = gpiozero.OutputDevice(23, active_high=True)
                self._gpio = True
            except Exception:
                self._mock = True
        if not self._mock:
            try:
                from luma.oled import spi_interface

                self._oled = spi_interface
            except Exception:
                self._oled = None

    def indicate(self, decision: str, predicted: str, confidence: float) -> None:
        self.last_state = f"{decision}:{predicted}:{confidence:.2f}"
        if self._gpio:
            if decision == "PASS":
                self._rgb_green.on()
                self._rgb_red.off()
                self._buzzer.off()
                self._relay.off()
            else:
                self._rgb_green.off()
                self._rgb_red.on()
                self._buzzer.beep(on_time=0.12, off_time=0.08, n=2)
                self._relay.on()
                time.sleep(0.5)
                self._relay.off()
        if self._oled is not None:
            self._draw_oled(decision, predicted, confidence)

    def _draw_oled(self, decision: str, predicted: str, confidence: float) -> None:
        try:
            from luma.core.interface.serial import spi
            from luma.oled.device import ssd1306

            serial = spi(port=0, device=0, gpio_DC=9, gpio_RST=8)
            device = ssd1306(serial, width=128, height=64)
            from PIL import Image, ImageDraw

            img = Image.new("1", (128, 64))
            draw = ImageDraw.Draw(img)
            draw.text((0, 0), "ThreadSight", fill=255)
            draw.text((0, 16), decision, fill=255)
            draw.text((0, 32), predicted[:16], fill=255)
            draw.text((0, 48), f"{confidence:.2f}", fill=255)
            device.display(img)
        except Exception:
            pass

    def show_status(self, text: str) -> None:
        self.last_state = text

    def close(self) -> None:
        if self._gpio:
            try:
                self._rgb_green.off()
                self._rgb_red.off()
                self._buzzer.off()
                self._relay.off()
            except Exception:
                pass
