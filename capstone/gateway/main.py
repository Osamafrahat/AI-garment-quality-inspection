import asyncio
import json
import queue
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

DB_PATH = Path(__file__).parent / "gateway.db"
LATEST_METRICS_PATH = Path(__file__).parent / "latest_metrics.json"

app = FastAPI(title="ThreadSight Gateway", version="1.0.0")

_state_lock = threading.Lock()
_subscribers: list[queue.Queue] = []
_threshold = {"value": 0.70}
_schedule = {
    "cut_no": 6,
    "product_line": "Line A — T-Shirt",
    "cut_date": "2026-08-06",
    "planned_pieces": 560,
}
_soak = {
    "published": 0,
    "received": 0,
    "gaps": [],
    "started_at": None,
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seq INTEGER,
            node_id TEXT,
            capture_ts TEXT,
            verdict_ts TEXT,
            received_at TEXT,
            decision TEXT,
            predicted_class TEXT,
            confidence REAL,
            threshold REAL,
            cut_no INTEGER,
            product_line TEXT,
            sensors TEXT,
            latency_ms TEXT,
            model_version TEXT,
            backend TEXT,
            scores TEXT,
            reasons TEXT
        );
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seq INTEGER,
            node_id TEXT,
            ts TEXT,
            received_at TEXT,
            lux REAL,
            temp_c REAL,
            humidity_pct REAL,
            queue_depth INTEGER,
            payload TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_insp_received ON inspections(received_at);
        """
    )
    conn.commit()
    conn.close()


init_db()


class VerdictIn(BaseModel):
    schema_: str | None = Field(default=None, alias="schema")
    seq: int | None = None
    node_id: str = "unknown"
    capture_ts: str | None = None
    verdict_ts: str | None = None
    decision: str
    predicted_class: str
    confidence: float
    threshold: float | None = None
    cut_no: int | None = None
    product_line: str | None = None
    sensors: dict[str, Any] = {}
    latency_ms: dict[str, Any] = {}
    model_version: str | None = None
    backend: str | None = None
    scores: dict[str, float] = {}
    reasons: list[str] = []
    self_test: bool = False

    model_config = {"populate_by_name": True}


class TelemetryIn(BaseModel):
    schema_: str | None = Field(default=None, alias="schema")
    seq: int | None = None
    node_id: str = "unknown"
    ts: str | None = None
    lux: float | None = None
    temp_c: float | None = None
    humidity_pct: float | None = None
    distance_mm: float | None = None
    queue_depth: int | None = None
    model_loaded: bool | None = None
    cycles: int | None = None

    model_config = {"populate_by_name": True}


class ThresholdIn(BaseModel):
    value: float = Field(ge=0.5, le=0.95)


def broadcast(event: str, data: dict[str, Any]) -> None:
    message = json.dumps(data, default=str)
    for q in list(_subscribers):
        try:
            q.put_nowait((event, message))
        except queue.Full:
            pass


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    for key in ("sensors", "latency_ms", "scores", "reasons"):
        if d.get(key):
            try:
                d[key] = json.loads(d[key])
            except Exception:
                pass
    return d


@app.get("/api/v1/health")
def health() -> dict[str, Any]:
    conn = db()
    count = conn.execute("SELECT COUNT(*) AS c FROM inspections").fetchone()["c"]
    conn.close()
    return {
        "status": "ok",
        "inspections": count,
        "threshold": _threshold["value"],
        "schedule": _schedule,
        "soak": _soak,
        "time": utc_now(),
    }


@app.post("/api/v1/inspections")
def create_inspection(payload: VerdictIn) -> JSONResponse:
    received_at = utc_now()
    conn = db()
    cur = conn.execute(
        """
        INSERT INTO inspections (
            seq, node_id, capture_ts, verdict_ts, received_at, decision,
            predicted_class, confidence, threshold, cut_no, product_line,
            sensors, latency_ms, model_version, backend, scores, reasons
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            payload.seq,
            payload.node_id,
            payload.capture_ts,
            payload.verdict_ts,
            received_at,
            payload.decision,
            payload.predicted_class,
            payload.confidence,
            payload.threshold if payload.threshold is not None else _threshold["value"],
            payload.cut_no,
            payload.product_line,
            json.dumps(payload.sensors),
            json.dumps(payload.latency_ms),
            payload.model_version,
            payload.backend,
            json.dumps(payload.scores),
            json.dumps(payload.reasons),
        ),
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()

    row = {
        "id": row_id,
        **payload.model_dump(exclude={"schema_"}),
        "schema": payload.schema_,
        "received_at": received_at,
    }
    if payload.seq is not None:
        with _state_lock:
            _soak["received"] += 1
            if _soak["started_at"] and payload.seq not in _soak["gaps"]:
                expected = _soak.get("last_seq")
                if expected is not None and payload.seq > expected + 1:
                    for missing in range(expected + 1, payload.seq):
                        _soak["gaps"].append(missing)
                _soak["last_seq"] = max(payload.seq, expected or 0)
    broadcast("inspection", row)
    return JSONResponse(row, status_code=201)


@app.get("/api/v1/inspections")
def list_inspections(
    limit: int = Query(50, ge=1, le=500),
    decision: str | None = None,
) -> list[dict[str, Any]]:
    conn = db()
    if decision:
        rows = conn.execute(
            "SELECT * FROM inspections WHERE decision=? ORDER BY id DESC LIMIT ?",
            (decision, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM inspections ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


@app.get("/api/v1/stats")
def stats() -> dict[str, Any]:
    conn = db()
    total = conn.execute("SELECT COUNT(*) c FROM inspections").fetchone()["c"]
    passes = conn.execute(
        "SELECT COUNT(*) c FROM inspections WHERE decision='PASS'"
    ).fetchone()["c"]
    fails = conn.execute(
        "SELECT COUNT(*) c FROM inspections WHERE decision='FAIL'"
    ).fetchone()["c"]
    by_class = conn.execute(
        """
        SELECT predicted_class, COUNT(*) c FROM inspections
        GROUP BY predicted_class ORDER BY c DESC
        """
    ).fetchall()
    lat_rows = conn.execute(
        "SELECT latency_ms FROM inspections WHERE latency_ms IS NOT NULL ORDER BY id DESC LIMIT 200"
    ).fetchall()
    ages = conn.execute(
        """
        SELECT (julianday(received_at) - julianday(capture_ts)) * 86400.0 AS age_s
        FROM inspections
        WHERE capture_ts IS NOT NULL
        ORDER BY id DESC LIMIT 200
        """
    ).fetchall()
    conn.close()

    edges = []
    for r in lat_rows:
        try:
            data = json.loads(r["latency_ms"])
            if "edge" in data:
                edges.append(float(data["edge"]))
        except Exception:
            pass
    e2e = [float(r["age_s"]) * 1000.0 for r in ages if r["age_s"] is not None]

    def p95(values: list[float]) -> float | None:
        if not values:
            return None
        values = sorted(values)
        idx = min(len(values) - 1, int(round(0.95 * (len(values) - 1))))
        return round(values[idx], 1)

    stats_payload = {
        "total": total,
        "pass": passes,
        "fail": fails,
        "pass_rate": round(passes / total, 4) if total else None,
        "by_class": {r["predicted_class"]: r["c"] for r in by_class},
        "latency_edge_p95_ms": p95(edges),
        "latency_e2e_p95_ms": p95(e2e),
        "threshold": _threshold["value"],
        "soak": dict(_soak),
        "updated_at": utc_now(),
    }
    LATEST_METRICS_PATH.write_text(json.dumps(stats_payload, indent=2))
    return stats_payload


@app.post("/api/v1/telemetry")
def ingest_telemetry(payload: TelemetryIn) -> dict[str, str]:
    received_at = utc_now()
    conn = db()
    conn.execute(
        """
        INSERT INTO telemetry (seq, node_id, ts, received_at, lux, temp_c, humidity_pct, queue_depth, payload)
        VALUES (?,?,?,?,?,?,?,?,?)
        """,
        (
            payload.seq,
            payload.node_id,
            payload.ts,
            received_at,
            payload.lux,
            payload.temp_c,
            payload.humidity_pct,
            payload.queue_depth,
            payload.model_dump_json(),
        ),
    )
    conn.commit()
    conn.close()
    broadcast(
        "telemetry",
        {"node_id": payload.node_id, "lux": payload.lux, "ts": received_at},
    )
    return {"status": "stored"}


@app.get("/api/v1/stream")
async def stream(request: Request) -> StreamingResponse:
    q: queue.Queue = queue.Queue(maxsize=200)
    _subscribers.append(q)

    async def gen():
        try:
            yield {
                "event": "hello",
                "data": json.dumps({"threshold": _threshold["value"], "ts": utc_now()}),
            }
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event, message = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: q.get(timeout=15)
                    )
                    yield {"event": event, "data": message}
                except queue.Empty:
                    yield {"event": "ping", "data": utc_now()}
        finally:
            if q in _subscribers:
                _subscribers.remove(q)

    return EventSourceResponse(gen())


@app.post("/api/v1/threshold")
def set_threshold(payload: ThresholdIn) -> dict[str, Any]:
    _threshold["value"] = payload.value
    broadcast("threshold", {"value": payload.value, "ts": utc_now()})
    return {"threshold": payload.value}


@app.get("/api/v1/threshold")
def get_threshold() -> dict[str, float]:
    return {"value": _threshold["value"]}


@app.get("/api/v1/schedule/active")
def active_schedule() -> dict[str, Any]:
    return _schedule


@app.post("/api/v1/schedule/active")
def set_schedule(payload: dict[str, Any]) -> dict[str, Any]:
    _schedule.update({k: payload[k] for k in _schedule if k in payload})
    broadcast("schedule", _schedule)
    return _schedule


@app.post("/api/v1/simulate")
def simulate(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    from simulate import generate_one

    row = generate_one(
        threshold=_threshold["value"],
        cut_no=_schedule.get("cut_no"),
        product_line=_schedule.get("product_line"),
        overrides=payload or {},
    )
    return create_inspection(VerdictIn(**row))


@app.post("/api/v1/soak/start")
def soak_start(count: int = 1000) -> dict[str, Any]:
    with _state_lock:
        _soak.update(
            {
                "published": count,
                "received": 0,
                "gaps": [],
                "started_at": utc_now(),
                "last_seq": None,
            }
        )
    return dict(_soak)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
