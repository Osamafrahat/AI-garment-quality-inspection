"""Severity assessment for detected defects.

Severity is derived from three signals:

1. **Intrinsic severity of the defect type** — a hole is always worse than a
   loose thread, regardless of how confident the model is.
2. **Relative area** — a stain covering 40% of the garment is far worse than a
   1% speck.
3. **Model confidence** — high confidence on a serious defect type pushes it up
   a tier, since it is unlikely to be a false positive.

The function is pure and deterministic, which makes it cheap to unit test and
easy to tune without re-running inference.
"""

from __future__ import annotations

from ..schemas import Severity

# Baseline severity on a 1..5 scale for each known defect class.
# Any unknown class defaults to 2 (low-but-not-negligible).
BASE_SEVERITY: dict[str, int] = {
    "normal": 0,
    "hole": 5,
    "tear": 5,
    "stain": 4,
    "print_misalign": 4,
    "seam_defect": 4,
    "color_fade": 3,
    "broken_thread": 3,
    "pilling": 2,
    "texture_irregular": 2,
    "snag": 3,
    "oil_spot": 4,
}

# Score (1..5) -> severity tier.
_TIER_BY_SCORE: dict[int, Severity] = {
    1: Severity.LOW,
    2: Severity.LOW,
    3: Severity.MEDIUM,
    4: Severity.HIGH,
    5: Severity.CRITICAL,
}


def assess_severity(
    label: str,
    confidence: float,
    area_ratio: float | None = None,
) -> Severity:
    """Map a detection to a severity tier.

    Args:
        label: Defect class name (e.g. ``"hole"``).
        confidence: Model confidence in ``0..1``.
        area_ratio: Fraction of the image the defect covers, in ``0..1``.
            Pass ``None`` when no localization is available.
    """
    key = label.strip().lower()
    score = BASE_SEVERITY.get(key, 2)

    if score <= 0:
        # "normal" / no-defect → nothing to escalate.
        return Severity.LOW

    if area_ratio is not None:
        if area_ratio > 0.35:
            score += 1
        if area_ratio > 0.60:
            score += 1

    if confidence >= 0.85:
        score += 1
    elif confidence < 0.50:
        score -= 1

    return _TIER_BY_SCORE[min(max(score, 1), 5)]
