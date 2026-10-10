"""Generate a small synthetic fabric dataset.

This exists so the full train → checkpoint → inference → UI loop can be
verified *before* you have real labelled photos. The images are plainly fake
(a woven texture with a defect drawn on top), but they are class-consistent,
which is exactly what the classifier needs to learn a decision boundary.

Usage (from ``backend/``)::

    python -m app.training.synth --out ../data --train 120 --val 30

Then train with ``python -m app.training.train --data ../data``.
"""

from __future__ import annotations

import argparse
import hashlib
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from ..model import DEFAULT_CLASSES

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_OUT = BACKEND_DIR.parent / "data"

# Plausible garment base colours.
PALETTE: list[tuple[int, int, int]] = [
    (30, 44, 84),  # navy
    (238, 238, 234),  # white
    (120, 124, 128),  # grey
    (24, 26, 28),  # black
    (72, 84, 52),  # olive
    (150, 40, 44),  # red
    (196, 152, 92),  # tan
    (38, 106, 120),  # teal
]


# --------------------------------------------------------------------- base
def _fabric(size: tuple[int, int], rng: random.Random) -> Image.Image:
    """Render a plain-woven texture with lighting variation."""
    width, height = size
    base = rng.choice(PALETTE)

    arr = np.zeros((height, width, 3), dtype=np.float32)
    arr[:] = base

    yy, xx = np.mgrid[0:height, 0:width]
    period = rng.uniform(2.5, 4.5)
    weave = np.sin(xx * np.pi / period) * 6 + np.sin(yy * np.pi / period) * 6
    arr += weave[..., None]

    arr += rng.gauss(0, 8) + np.random.default_rng(rng.randrange(1 << 30)).normal(0, 8, (height, width, 1))

    # Soft directional lighting so the model doesn't latch onto flat colour.
    gradient = np.linspace(-14, 14, width, dtype=np.float32)[None, :]
    arr += gradient[..., None]

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def _shade(color: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    return tuple(max(0, min(255, int(c * factor))) for c in color)  # type: ignore[return-value]


def _overlay(size: tuple[int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    return layer, ImageDraw.Draw(layer)


def _paste(base: Image.Image, layer: Image.Image) -> Image.Image:
    out = base.convert("RGBA")
    out.alpha_composite(layer)
    return out.convert("RGB")


# ------------------------------------------------------------------ defects
def _draw_hole(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    cx = rng.uniform(0.2, 0.8) * size[0]
    cy = rng.uniform(0.2, 0.8) * size[1]
    radius = rng.uniform(0.05, 0.13) * min(size)

    # Frayed halo first, then the void.
    halo = []
    void = []
    for i in range(14):
        angle = i / 14 * np.pi * 2
        jitter = 1 + rng.uniform(-0.3, 0.3)
        halo.append((cx + np.cos(angle) * radius * 1.5 * jitter, cy + np.sin(angle) * radius * 1.5 * jitter))
        void.append((cx + np.cos(angle) * radius * jitter, cy + np.sin(angle) * radius * jitter))

    draw.polygon(halo, fill=(232, 228, 220, 190))
    draw.polygon(void, fill=(8, 8, 10, 255))
    layer = layer.filter(ImageFilter.GaussianBlur(1.2))
    return _paste(img, layer)


def _draw_stain(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    cx = rng.uniform(0.15, 0.85) * size[0]
    cy = rng.uniform(0.15, 0.85) * size[1]
    rx = rng.uniform(0.08, 0.20) * size[0]
    ry = rng.uniform(0.08, 0.20) * size[1]
    colour = rng.choice([(78, 52, 30), (40, 60, 90), (28, 26, 24), (110, 96, 40)])
    alpha = rng.randint(140, 220)

    for _ in range(rng.randint(2, 4)):
        ox, oy = rng.uniform(-0.4, 0.4) * rx, rng.uniform(-0.4, 0.4) * ry
        draw.ellipse(
            [cx - rx + ox, cy - ry + oy, cx + rx + ox, cy + ry + oy],
            fill=(*colour, alpha // 2),
        )
    layer = layer.filter(ImageFilter.GaussianBlur(rng.uniform(4, 9)))
    return _paste(img, layer)


def _draw_broken_thread(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    x = rng.uniform(0.15, 0.85) * size[0]
    y0 = rng.uniform(0.1, 0.5) * size[1]
    length = rng.uniform(0.2, 0.45) * size[1]
    colour = (245, 240, 230, 235)

    # Two stitch runs with a missing segment between them.
    gap_start = y0 + length * rng.uniform(0.3, 0.6)
    gap_end = gap_start + length * rng.uniform(0.1, 0.2)
    for y in np.arange(y0, gap_start, 5):
        draw.line([x, y, x + rng.uniform(-3, 3), y + 4], fill=colour, width=2)
    for y in np.arange(gap_end, y0 + length, 5):
        draw.line([x, y, x + rng.uniform(-3, 3), y + 4], fill=colour, width=2)

    # The loose end curling away from the seam.
    draw.line(
        [x, gap_start, x + rng.uniform(10, 40), gap_start + rng.uniform(5, 30)],
        fill=colour,
        width=2,
    )
    return _paste(img, layer)


def _draw_pilling(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    cx, cy = rng.uniform(0.2, 0.8) * size[0], rng.uniform(0.2, 0.8) * size[1]
    spread = rng.uniform(0.10, 0.22) * min(size)
    for _ in range(rng.randint(14, 30)):
        px = cx + rng.gauss(0, spread)
        py = cy + rng.gauss(0, spread)
        r = rng.uniform(2, 5)
        draw.ellipse([px - r, py - r, px + r, py + r], fill=(226, 222, 214, 210))
    layer = layer.filter(ImageFilter.GaussianBlur(0.8))
    return _paste(img, layer)


def _draw_color_fade(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    x0 = rng.uniform(-0.1, 0.4) * size[0]
    y0 = rng.uniform(-0.1, 0.4) * size[1]
    w = rng.uniform(0.4, 0.7) * size[0]
    h = rng.uniform(0.4, 0.7) * size[1]
    draw.ellipse([x0, y0, x0 + w, y0 + h], fill=(255, 250, 235, rng.randint(70, 120)))
    layer = layer.filter(ImageFilter.GaussianBlur(rng.uniform(18, 34)))
    return _paste(img, layer)


def _draw_print_misalign(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    colour = rng.choice([(250, 250, 250), (20, 20, 24), (240, 210, 60)])
    step = rng.uniform(0.14, 0.2) * min(size)
    shape = rng.choice(["rect", "circle", "tri"])
    offset_row = rng.randint(0, 3)

    rows = int(size[1] / step) + 1
    cols = int(size[0] / step) + 1
    for r in range(rows):
        shift = step * 0.45 if r == offset_row else 0.0
        for c in range(cols):
            cx, cy = c * step + step * 0.25 + shift, r * step + step * 0.25
            half = step * 0.24
            if shape == "rect":
                draw.rectangle([cx - half, cy - half, cx + half, cy + half], fill=(*colour, 225))
            elif shape == "circle":
                draw.ellipse([cx - half, cy - half, cx + half, cy + half], fill=(*colour, 225))
            else:
                draw.polygon(
                    [(cx, cy - half), (cx - half, cy + half), (cx + half, cy + half)],
                    fill=(*colour, 225),
                )
    return _paste(img, layer)


def _draw_seam_defect(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    vertical = rng.random() < 0.5
    pos = rng.uniform(0.25, 0.75)
    thread = (246, 242, 232, 240)
    torn = (16, 14, 14, 255)

    if vertical:
        x = pos * size[0]
        draw.line([x, 0, x, size[1]], fill=torn, width=3)
        # Stitches that stop short — the actual defect.
        stop = rng.uniform(0.35, 0.7) * size[1]
        for y in range(0, int(stop), 7):
            draw.line([x - 7, y, x - 1, y + 5], fill=thread, width=2)
        draw.line([x - 7, stop, x + 7, stop + 10], fill=thread, width=3)
    else:
        y = pos * size[1]
        draw.line([0, y, size[0], y], fill=torn, width=3)
        stop = rng.uniform(0.35, 0.7) * size[0]
        for x in range(0, int(stop), 7):
            draw.line([x, y - 7, x + 5, y - 1], fill=thread, width=2)
    return _paste(img, layer)


def _draw_texture_irregular(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    x0 = rng.uniform(0.1, 0.6) * size[0]
    y0 = rng.uniform(0.1, 0.6) * size[1]
    bw = rng.uniform(0.2, 0.35) * size[0]
    bh = rng.uniform(0.2, 0.35) * size[1]
    shade = rng.choice([(0, 0, 0, 90), (255, 255, 255, 70)])
    draw.rectangle([x0, y0, x0 + bw, y0 + bh], fill=shade)
    # Break up the weave inside the patch.
    for _ in range(int(bw * bh / 90)):
        sx = rng.uniform(x0, x0 + bw)
        sy = rng.uniform(y0, y0 + bh)
        draw.line([sx, sy, sx + rng.uniform(-9, 9), sy + rng.uniform(-9, 9)],
                  fill=(0, 0, 0, 110), width=1)
    layer = layer.filter(ImageFilter.GaussianBlur(1.5))
    return _paste(img, layer)


def _draw_snag(img: Image.Image, rng: random.Random) -> Image.Image:
    size = img.size
    layer, draw = _overlay(size)
    x, y = rng.uniform(0.2, 0.8) * size[0], rng.uniform(0.2, 0.8) * size[1]
    colour = (250, 246, 236, 245)
    length = rng.uniform(0.06, 0.16) * min(size)
    angle = rng.uniform(0, np.pi * 2)
    ex, ey = x + np.cos(angle) * length, y + np.sin(angle) * length
    draw.line([x, y, ex, ey], fill=colour, width=3)
    draw.ellipse([ex - 5, ey - 5, ex + 5, ey + 5], outline=colour, width=2)
    return _paste(img, layer)


_RENDERERS = {
    "hole": _draw_hole,
    "tear": _draw_hole,
    "stain": _draw_stain,
    "oil_spot": _draw_stain,
    "broken_thread": _draw_broken_thread,
    "pilling": _draw_pilling,
    "color_fade": _draw_color_fade,
    "print_misalign": _draw_print_misalign,
    "seam_defect": _draw_seam_defect,
    "texture_irregular": _draw_texture_irregular,
    "snag": _draw_snag,
}


def render(label: str, size: tuple[int, int], seed: int) -> Image.Image:
    """Render one labelled synthetic sample. Deterministic for a given seed."""
    rng = random.Random(seed)

    img = _fabric(size, rng)
    renderer = _RENDERERS.get(label)
    if renderer is None:
        return img  # "normal" and any unknown class stay clean
    return renderer(img, rng)


def _seed_for(master: int, label: str, split: str, index: int) -> int:
    payload = f"{master}:{label}:{split}:{index}".encode()
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big")


def generate(
    out: Path,
    classes: list[str],
    train_per_class: int,
    val_per_class: int,
    size: int,
    seed: int,
) -> Path:
    for label in classes:
        for split, count in (("train", train_per_class), ("val", val_per_class)):
            target = out / split / label
            target.mkdir(parents=True, exist_ok=True)
            for i in range(count):
                image = render(label, (size, size), _seed_for(seed, label, split, i))
                image.save(target / f"{label}_{i:04d}.jpg", quality=90)
        print(f"  {label:<18} {train_per_class} train / {val_per_class} val")
    return out


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Dataset root to create.")
    parser.add_argument("--train", type=int, default=120, help="Images per class for training.")
    parser.add_argument("--val", type=int, default=30, help="Images per class for validation.")
    parser.add_argument("--size", type=int, default=224, help="Square image size.")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument(
        "--classes",
        nargs="+",
        default=DEFAULT_CLASSES,
        help="Subset of classes to generate.",
    )
    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()
    print(f"Writing synthetic dataset to {args.out}")
    generate(args.out, args.classes, args.train, args.val, args.size, args.seed)
    print("Done.")
