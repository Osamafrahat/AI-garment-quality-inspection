"""Verdict and quality-score computation.

Given the defects found on a garment, produce:

* a **quality score** (0-100, higher is better) that degrades with the number
  and severity of defects, and
* a **verdict** (``pass`` / ``review`` / ``fail``) for production gating.

Scoring is deliberately transparent so a QA engineer can reason about why a
garment was rejected — no hidden model in the decision layer.
"""

from __future__ import annotations

from ..schemas import Defect, Severity, Verdict

# Weighted penalty applied per defect, scaled by severity.
_SEVERITY_PENALTY: dict[Severity, float] = {
    Severity.LOW: 4.0,
    Severity.MEDIUM: 10.0,
    Severity.HIGH: 22.0,
    Severity.CRITICAL: 45.0,
}

# Score thresholds. A garment with no defects scores 100.
REVIEW_BELOW = 80.0  # score < 80 → needs human review
FAIL_BELOW = 55.0  # score < 55 → outright fail


def score_garment(defects: list[Defect]) -> float:
    """Return a 0-100 quality score. Each defect subtracts a severity-weighted
    penalty, scaled by (but not fully equal to) its confidence."""
    score = 100.0
    for defect in defects:
        penalty = _SEVERITY_PENALTY[defect.severity]
        # Confidence scales the penalty between 50% and 100% so borderline
        # detections don't tank the score.
        score -= penalty * (0.5 + 0.5 * defect.confidence)
    return max(score, 0.0)


def decide_verdict(score: float, defects: list[Defect]) -> Verdict:
    """Map a quality score (and critical-defect presence) to a verdict.

    A single critical defect forces a ``fail`` regardless of the aggregate
    score — some defects are never acceptable on a shipped garment.
    """
    has_critical = any(d.severity is Severity.CRITICAL for d in defects)

    # A critical defect is never shippable, and neither is a very low score.
    if has_critical or score < FAIL_BELOW:
        return Verdict.FAIL

    # Anything detectably imperfect goes to a human rather than straight out.
    if defects or score < REVIEW_BELOW:
        return Verdict.REVIEW

    return Verdict.PASS
