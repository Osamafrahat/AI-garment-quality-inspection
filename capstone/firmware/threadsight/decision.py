from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
    decision: str
    predicted_class: str
    confidence: float
    threshold: float
    light_ok: bool
    reasons: tuple[str, ...]


def apply(
    scores: dict[str, float],
    classes: list[str],
    threshold: float,
    light_ok: bool,
    strict_light: bool = False,
) -> Decision:
    predicted = max(scores, key=scores.get)
    confidence = float(scores[predicted])
    reasons: list[str] = []

    if predicted != "ok":
        reasons.append(f"defect:{predicted}")
    if confidence < threshold:
        reasons.append(f"low_confidence<{threshold}")
    if not light_ok:
        reasons.append("light_out_of_band")
        if strict_light:
            reasons.append("strict_light_fail")

    failed = predicted != "ok" or confidence < threshold or (
        strict_light and not light_ok
    )
    return Decision(
        decision="FAIL" if failed else "PASS",
        predicted_class=predicted,
        confidence=confidence,
        threshold=threshold,
        light_ok=light_ok,
        reasons=tuple(reasons),
    )
