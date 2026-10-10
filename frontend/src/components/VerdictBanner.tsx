import type { InspectionResult, Verdict } from "../types";

interface Props {
  result: InspectionResult;
}

const COPY: Record<Verdict, { title: string; note: string }> = {
  pass: {
    title: "Pass",
    note: "No defects detected. Cleared for the next stage.",
  },
  review: {
    title: "Needs review",
    note: "Defects found below the rejection threshold — route to a QC inspector.",
  },
  fail: {
    title: "Fail",
    note: "Defects severe enough to reject this unit.",
  },
};

export function VerdictBanner({ result }: Props) {
  const { verdict, quality_score: score, defects } = result;
  const copy = COPY[verdict];

  return (
    <div className={`verdict verdict-${verdict}`}>
      <div className="verdict-row">
        <div>
          <span className="verdict-label">Verdict</span>
          <h3>{copy.title}</h3>
          <p>{copy.note}</p>
        </div>
        <div className="score">
          <span className="score-value">{score.toFixed(0)}</span>
          <span className="score-unit">/ 100</span>
        </div>
      </div>

      <div className="score-track" aria-hidden="true">
        <span className="score-fill" style={{ width: `${score}%` }} />
      </div>

      <div className="stat-row">
        <span>
          <strong>{defects.length}</strong> defect{defects.length === 1 ? "" : "s"} flagged
        </span>
        <span>
          <strong>{result.inference_ms.toFixed(1)}</strong> ms inference
        </span>
        <span>
          {result.model.mode === "demo" ? "synthetic output" : "trained model"}
        </span>
      </div>
    </div>
  );
}
