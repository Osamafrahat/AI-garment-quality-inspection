import json
import threading
import time
from datetime import datetime, timezone

import requests

from .config import Config


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


class IoTPublisher:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.seq = 0
        self._mqtt = None
        self._lock = threading.Lock()
        self._queue: list[dict] = []
        if config.mqtt_enabled and not config.mock:
            try:
                import paho.mqtt.client as mqtt

                self._mqtt = mqtt.Client(
                    callback_api_version=mqtt.CallbackAPIVersion.VERSION2
                )
                self._mqtt.connect(config.mqtt_host, config.mqtt_port, keepalive=30)
                self._mqtt.loop_start()
            except Exception:
                self._mqtt = None
        elif config.mqtt_enabled and config.mock:
            try:
                import paho.mqtt.client as mqtt

                self._mqtt = mqtt.Client(
                    callback_api_version=mqtt.CallbackAPIVersion.VERSION2
                )
                self._mqtt.connect(config.mqtt_host, config.mqtt_port, keepalive=30)
                self._mqtt.loop_start()
            except Exception:
                self._mqtt = None

    def next_seq(self) -> int:
        with self._lock:
            self.seq += 1
            return self.seq

    def publish_verdict(self, payload: dict) -> bool:
        ok_mqtt = True
        ok_rest = True
        topic = f"threadsight/node/{self.config.node_id}/verdict"
        if self._mqtt is not None:
            try:
                self._mqtt.publish(topic, json.dumps(payload), qos=1)
            except Exception:
                ok_mqtt = False
        if self.config.rest_enabled:
            try:
                resp = requests.post(
                    f"{self.config.gateway_url.rstrip('/')}/api/v1/inspections",
                    json=payload,
                    timeout=2.0,
                )
                ok_rest = resp.ok
            except Exception:
                ok_rest = False
                with self._lock:
                    self._queue.append(payload)
        self._drain_queue()
        return ok_mqtt or ok_rest

    def publish_telemetry(self, payload: dict) -> None:
        topic = f"threadsight/node/{self.config.node_id}/telemetry"
        if self._mqtt is not None:
            try:
                self._mqtt.publish(topic, json.dumps(payload), qos=0)
            except Exception:
                pass
        try:
            requests.post(
                f"{self.config.gateway_url.rstrip('/')}/api/v1/telemetry",
                json=payload,
                timeout=1.5,
            )
        except Exception:
            pass

    def _drain_queue(self) -> None:
        if not self._queue:
            return
        pending = list(self._queue)
        self._queue.clear()
        for payload in pending:
            try:
                resp = requests.post(
                    f"{self.config.gateway_url.rstrip('/')}/api/v1/inspections",
                    json=payload,
                    timeout=2.0,
                )
                if not resp.ok:
                    self._queue.append(payload)
            except Exception:
                self._queue.append(payload)

    def queue_depth(self) -> int:
        return len(self._queue)

    def close(self) -> None:
        if self._mqtt is not None:
            try:
                self._mqtt.loop_stop()
                self._mqtt.disconnect()
            except Exception:
                pass
