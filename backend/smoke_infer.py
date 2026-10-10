"""One-off smoke test: hit /api/inspect with held-out synthetic val images."""

from __future__ import annotations

import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
VAL = ROOT / "data" / "val"
URL = "http://127.0.0.1:8000/api/inspect"

classes = sys.argv[1:] or ["stain", "hole", "pilling", "normal"]

with httpx.Client(timeout=120.0) as client:
    for cls in classes:
        files = sorted((VAL / cls).glob("*.jpg"))
        if not files:
            print(f"{cls:<8} -> (no val images)")
            continue
        img = files[0]
        with img.open("rb") as fh:
            resp = client.post(URL, files={"file": (img.name, fh, "image/jpeg")})
        resp.raise_for_status()
        r = resp.json()
        defects = ", ".join(
            f"{d['label']}@{d['confidence']:.2f}[{d['severity']}]"
            for d in r["defects"]
        )
        boxed = sum(1 for d in r["defects"] if d["box"])
        print(
            f"{cls:<8} -> verdict={r['verdict']:<7} score={r['quality_score']:3.0f} "
            f"n={len(r['defects'])} boxes={boxed} annotated={bool(r['annotated_image'])} "
            f"ms={r['inference_ms']}"
        )
        print(f"         defects: {defects}")
