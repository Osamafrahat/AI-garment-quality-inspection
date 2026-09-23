import argparse
import csv
import json
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CLASSES = [
    "ok",
    "hole",
    "stain",
    "broken_thread",
    "shade_variation",
    "print_misalignment",
]

SEVERITIES = (0.25, 0.4, 0.55, 0.7, 0.85, 1.0)


def weave_texture(size: int, rng: random.Random) -> Image.Image:
    base = rng.randint(160, 220)
    tint = np.array(
        [rng.randint(-25, 25), rng.randint(-25, 25), rng.randint(-25, 25)],
        dtype=np.int16,
    )
    yy, xx = np.mgrid[0:size, 0:size]
    period = rng.choice([4, 5, 6, 7])
    warp = ((xx // period) % 2) * 18
    weft = ((yy // period) % 2) * 14
    noise = rng.randint(0, 1)
    arr = np.full((size, size, 3), base, dtype=np.int16)
    arr[..., 0] += tint[0]
    arr[..., 1] += tint[1]
    arr[..., 2] += tint[2]
    arr += (warp + weft)[..., None]
    if noise:
        arr += np.random.default_rng(rng.randint(0, 10**6)).integers(
            -10, 11, size=(size, size, 3)
        )
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    if rng.random() < 0.4:
        img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    return img


def print_pattern_overlay(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size[0]
    draw = ImageDraw.Draw(img)
    color = tuple(rng.randint(20, 90) for _ in range(3))
    spacing = rng.randint(10, 18)
    thickness = rng.randint(3, 6)
    offset = rng.randint(0, spacing)
    if rng.random() < 0.5:
        for x in range(offset, size, spacing):
            draw.rectangle([x, 0, x + thickness, size], fill=color)
    else:
        for y in range(offset, size, spacing):
            draw.rectangle([0, y, size, y + thickness], fill=color)
    return img


def add_hole(img: Image.Image, severity: float, rng: random.Random) -> Image.Image:
    size = img.size[0]
    draw = ImageDraw.Draw(img)
    r = max(3, int(size * 0.05 + severity * size * 0.16))
    cx = rng.randint(r + 2, size - r - 2)
    cy = rng.randint(r + 2, size - r - 2)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(15, 12, 10))
    fray = max(2, int(r * 0.35))
    for _ in range(int(12 * severity) + 4):
        ang = rng.random() * 6.283
        x0 = cx + int(np.cos(ang) * r)
        y0 = cy + int(np.sin(ang) * r)
        x1 = cx + int(np.cos(ang) * (r + fray))
        y1 = cy + int(np.sin(ang) * (r + fray))
        draw.line([x0, y0, x1, y1], fill=(235, 230, 220), width=1)
    return img


def add_stain(img: Image.Image, severity: float, rng: random.Random) -> Image.Image:
    size = img.size[0]
    stain_color = rng.choice(
        [(92, 58, 30), (40, 60, 140), (120, 30, 30), (60, 100, 60)]
    )
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    r = max(6, int(size * 0.08 + severity * size * 0.22))
    cx = rng.randint(r, size - r)
    cy = rng.randint(r, size - r)
    alpha = int(60 + 170 * severity)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=stain_color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=2 + 4 * severity))
    out = img.convert("RGBA")
    out = Image.alpha_composite(out, layer)
    return out.convert("RGB")


def add_broken_thread(
    img: Image.Image, severity: float, rng: random.Random
) -> Image.Image:
    size = img.size[0]
    draw = ImageDraw.Draw(img)
    horizontal = rng.random() < 0.5
    pos = rng.randint(size // 5, 4 * size // 5)
    gap = max(4, int(size * 0.1 + severity * size * 0.5))
    start = rng.randint(0, max(1, size - gap))
    dark = tuple(max(0, c - 70) for c in img.getpixel((1, 1)))
    if horizontal:
        draw.rectangle([start, pos - 2, start + gap, pos + 2], fill=dark)
        for x in range(start, min(size, start + gap), 3):
            draw.line([x, pos, x, pos + rng.randint(2, 6)], fill=(240, 235, 225))
    else:
        draw.rectangle([pos - 2, start, pos + 2, start + gap], fill=dark)
        for y in range(start, min(size, start + gap), 3):
            draw.line([pos, y, pos + rng.randint(2, 6), y], fill=(240, 235, 225))
    return img


def add_shade_variation(
    img: Image.Image, severity: float, rng: random.Random
) -> Image.Image:
    size = img.size[0]
    arr = np.asarray(img).astype(np.float32)
    yy, xx = np.mgrid[0:size, 0:size]
    cx, cy = rng.randint(0, size), rng.randint(0, size)
    sigma = size * (0.15 + 0.25 * severity)
    blob = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma**2)))
    delta = (rng.choice([-1, 1]) * (25 + 55 * severity)) * blob
    arr[..., 0] += delta * rng.uniform(0.7, 1.2)
    arr[..., 1] += delta * rng.uniform(0.7, 1.2)
    arr[..., 2] += delta * rng.uniform(0.7, 1.2)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def add_print_misalignment(
    img: Image.Image, severity: float, rng: random.Random
) -> Image.Image:
    size = img.size[0]
    aligned = print_pattern_overlay(img.copy(), rng)
    draw = ImageDraw.Draw(aligned)
    color = tuple(rng.randint(15, 80) for _ in range(3))
    spacing = rng.randint(10, 18)
    thickness = rng.randint(3, 6)
    shift = max(2, int(severity * spacing * 0.9))
    half = size // 2
    for x in range(0, size, spacing):
        draw.rectangle([x + shift, 0, x + shift + thickness, half], fill=color)
    edge = tuple(min(255, c + 90) for c in color)
    draw.line([0, half, size, half], fill=edge, width=2)
    return aligned


DEFECT_FN = {
    "hole": add_hole,
    "stain": add_stain,
    "broken_thread": add_broken_thread,
    "shade_variation": add_shade_variation,
    "print_misalignment": add_print_misalignment,
}


def generate_split(
    out_dir: Path,
    counts: dict[str, int],
    seed: int,
    source: str,
    size: int,
    manifest: list[dict],
) -> None:
    for cls, n in counts.items():
        cls_dir = out_dir / cls
        cls_dir.mkdir(parents=True, exist_ok=True)
        for i in range(n):
            rng = random.Random(seed * 100003 + hash(cls) % 99991 + i)
            img = weave_texture(size, rng)
            severity = 0.0
            if cls != "ok":
                if rng.random() < 0.35:
                    img = print_pattern_overlay(img, rng)
                severity = SEVERITIES[i % len(SEVERITIES)]
                img = DEFECT_FN[cls](img, severity, rng)
            name = f"{cls}_{i:04d}.png"
            path = cls_dir / name
            img.save(path)
            rel = f"{out_dir.name}/{cls}/{name}"
            manifest.append(
                {
                    "path": rel,
                    "class": cls,
                    "class_id": CLASSES.index(cls),
                    "source": source,
                    "severity": severity,
                    "seed": seed,
                    "split": out_dir.name,
                }
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate ThreadSight fabric dataset")
    parser.add_argument("--out", default=str(Path(__file__).parent / "dataset"))
    parser.add_argument("--per-class", type=int, default=500)
    parser.add_argument("--size", type=int, default=128)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    root = Path(args.out)
    root.mkdir(parents=True, exist_ok=True)
    per = args.per_class
    n_train = int(per * 0.70)
    n_val = int(per * 0.15)
    n_test = per - n_train - n_val

    manifest: list[dict] = []
    for split, n, seed_off in (
        ("train", n_train, 1),
        ("val", n_val, 2),
        ("test", n_test, 3),
    ):
        counts = {c: n for c in CLASSES}
        generate_split(
            root / split,
            counts,
            seed=args.seed + seed_off,
            source="synth",
            size=args.size,
            manifest=manifest,
        )

    (root / "labels.json").write_text(json.dumps(CLASSES, indent=2))
    with (root / "dataset_manifest.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "path",
                "class",
                "class_id",
                "source",
                "severity",
                "seed",
                "split",
            ],
        )
        writer.writeheader()
        writer.writerows(manifest)

    print(
        f"Dataset written to {root} | train={n_train}/class val={n_val}/class "
        f"test={n_test}/class total={len(manifest)}"
    )


if __name__ == "__main__":
    main()
