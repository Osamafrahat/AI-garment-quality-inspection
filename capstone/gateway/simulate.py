import argparse
import random
import time
from datetime import datetime, timezone

import requests

CLASSES_DEFECT = ["hole", "stain", "broken_thread", "shade_variation", "print_misalignment"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def generate_one(
    threshold: float = 0.70,
    cut_no: int | None = 6,
    product_line: str | None = "Line A — T-Shirt",
    overrides: dict | None = None,
    seq: int | None = None,
) -> dict:
    overrides = dict(overrides or {})
    if seq is not None:
        overrides["seq"] = seq
    force_fail = overrides.get("force_fail")
    force_pass = overrides.get("force_pass")
    if force_fail:
        cls = overrides.get("class") or random.choice(CLASSES_DEFECT)
        conf = round(random.uniform(0.75, 0.99), 4)
    elif force_pass:
        cls = "ok"
        conf = round(random.uniform(max(threshold, 0.70), 0.99), 4)
    else:
        if random.random() < 0.25:
            cls = random.choice(CLASSES_DEFECT)
            conf = round(random.uniform(threshold, 0.99), 4)
        else:
            cls = "ok"
            conf = round(random.uniform(threshold, 0.99), 4)

    decision = "FAIL" if (cls != "ok" or conf < threshold) else "PASS"
    scores = {c: 0.02 for c in ["ok", *CLASSES_DEFECT]}
    scores[cls] = conf
    rest = max(0.0, 1.0 - conf)
    n = len(scores) - 1
    for c in scores:
        if c != cls:
            scores[c] = round(rest / n, 4)

    capture = utc_now()
    edge = int(random.gauss(380, 60))
    edge = max(120, edge)

    return {
        "schema": "threadsight.verdict.v1",
        "seq": overrides.get("seq"),
        "node_id": overrides.get("node_id", "ts-node-01"),
        "capture_ts": capture,
        "verdict_ts": utc_now(),
        "decision": decision,
        "predicted_class": cls,
        "confidence": conf,
        "threshold": threshold,
        "scores": scores,
        "reasons": [] if decision == "PASS" else [f"defect:{cls}"],
        "cut_no": cut_no,
        "product_line": product_line,
        "sensors": {
            "lux": overrides.get("lux", round(random.uniform(420, 650), 1)),
            "temp_c": round(random.uniform(23.5, 26.0), 2),
            "humidity_pct": round(random.uniform(38, 48), 1),
            "distance_mm": round(random.uniform(60, 95), 1),
            "light_ok": True,
        },
        "latency_ms": {"edge": edge, "e2e_est": edge + random.randint(80, 250)},
        "model_version": overrides.get("model_version", "threadsight-sklearn-v1"),
        "backend": overrides.get("backend", "simulator"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="ThreadSight exhibition simulator")
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--interval", type=float, default=0.4)
    parser.add_argument("--soak", type=int, default=0)
    parser.add_argument("--gap-ms", type=int, default=200)
    args = parser.parse_args()

    base = args.url.rstrip("/")
    session = requests.Session()

    if args.soak:
        session.post(
            f"{base}/api/v1/soak/start", params={"count": args.soak}, timeout=5
        )
        print(f"Soak publishing {args.soak} messages...", flush=True)
        published = 0
        t0 = time.time()
        for seq in range(1, args.soak + 1):
            payload = generate_one(seq=seq)
            payload["seq"] = seq
            try:
                resp = session.post(
                    f"{base}/api/v1/inspections", json=payload, timeout=3
                )
                if resp.status_code == 201:
                    published += 1
            except Exception as exc:
                print(f"seq {seq} failed: {exc}", flush=True)
            if args.gap_ms:
                time.sleep(args.gap_ms / 1000.0)
            if seq % 100 == 0:
                print(f"  {seq}/{args.soak} ({time.time() - t0:.1f}s)", flush=True)
        time.sleep(0.5)
        health = session.get(f"{base}/api/v1/health", timeout=5).json()
        soak = health.get("soak", {})
        ratio = (soak.get("received", 0) / args.soak) if args.soak else 0
        print(
            f"published={published} received={soak.get('received')} "
            f"ratio={ratio:.3f} gaps={len(soak.get('gaps', []))}",
            flush=True,
        )
        if ratio < 0.99:
            raise SystemExit(1)
        return

    print(f"Streaming {args.count} inspections to {base} ...", flush=True)
    for i in range(args.count):
        payload = generate_one(seq=i + 1)
        try:
            session.post(f"{base}/api/v1/inspections", json=payload, timeout=2)
            print(f"{i + 1:03d} {payload['decision']} {payload['predicted_class']}", flush=True)
        except Exception as exc:
            print(f"publish failed: {exc}", flush=True)
            break
        time.sleep(args.interval)
    print("done", flush=True)


if __name__ == "__main__":
    main()
