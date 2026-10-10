"""Severity scoring unit tests — no torch or server required."""

from __future__ import annotations

import pytest

from app.core.quality import decide_verdict, score_garment
from app.core.severity import assess_severity
from app.schemas import Defect, DefectBox, Severity, Verdict


@pytest.mark.parametrize(
    "label,confidence,area,expected",
    [
        # Intrinsic severity dominates.
        ("hole", 0.60, None, Severity.CRITICAL),
        ("hole", 0.90, None, Severity.CRITICAL),
        ("pilling", 0.60, None, Severity.LOW),
        ("stain", 0.60, None, Severity.HIGH),
        # Area escalates a mild defect.
        ("pilling", 0.60, 0.50, Severity.MEDIUM),
        ("texture_irregular", 0.60, 0.70, Severity.HIGH),
        # Confidence escalates.
        ("color_fade", 0.90, None, Severity.HIGH),
        # Low confidence de-escalates.
        ("color_fade", 0.40, None, Severity.LOW),
        # Unknown classes don't crash.
        ("mystery_defect", 0.70, None, Severity.LOW),
    ],
)
def test_assess_severity(label, confidence, area, expected):
    assert assess_severity(label, confidence, area) is expected


def test_severity_is_clamped_to_known_tiers():
    """A defect that stacks every escalation still maps to a valid tier."""
    result = assess_severity("hole", 0.99, area_ratio=0.99)
    assert result in set(Severity)


def _defect(label: str, severity: Severity, confidence: float = 0.9) -> Defect:
    return Defect(
        label=label,
        confidence=confidence,
        severity=severity,
        box=DefectBox(x=0.1, y=0.1, w=0.2, h=0.2),
    )


def test_clean_garment_scores_full_marks():
    assert score_garment([]) == 100.0
    assert decide_verdict(100.0, []) is Verdict.PASS


def test_score_decreases_with_more_and_worse_defects():
    single = score_garment([_defect("pilling", Severity.LOW)])
    multiple = score_garment(
        [
            _defect("pilling", Severity.LOW),
            _defect("stain", Severity.HIGH),
            _defect("hole", Severity.CRITICAL),
        ]
    )
    assert multiple < single < 100.0


def test_score_never_goes_negative():
    catastrophic = [_defect(f"d{i}", Severity.CRITICAL) for i in range(8)]
    assert score_garment(catastrophic) == 0.0


def test_critical_defect_always_fails():
    """Aggregate score alone must never override a critical defect."""
    defects = [_defect("hole", Severity.CRITICAL, confidence=0.99)]
    assert score_garment(defects) > 55.0  # score would otherwise pass review
    assert decide_verdict(score_garment(defects), defects) is Verdict.FAIL


def test_minor_defect_triggers_review_not_pass():
    defects = [_defect("pilling", Severity.LOW, confidence=0.6)]
    score = score_garment(defects)
    assert score > 80.0
    assert decide_verdict(score, defects) is Verdict.REVIEW


def test_medium_score_triggers_review():
    defects = [_defect("stain", Severity.HIGH)]
    score = score_garment(defects)
    assert decide_verdict(score, defects) is Verdict.REVIEW


def test_very_low_score_fails():
    defects = [_defect(f"d{i}", Severity.CRITICAL) for i in range(3)]
    defects = [
        _defect("stain", Severity.HIGH, 0.9),
        _defect("hole", Severity.CRITICAL, 0.9),
        _defect("seam_defect", Severity.HIGH, 0.9),
    ]
    score = score_garment(defects)
    assert score < 55.0
    assert decide_verdict(score, defects) is Verdict.FAIL
