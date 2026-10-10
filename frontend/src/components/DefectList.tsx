import type { Defect } from "../types";

interface Props {
  defects: Defect[];
  classes: string[];
}

const SEVERITY_LABEL: Record<Defect["severity"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function DefectList({ defects, classes }: Props) {
  if (defects.length === 0) {
    return (
      <div className="clean">
        <span className="clean-mark" aria-hidden="true" />
        <h3>No defects detected</h3>
        <p>
          The model classified this specimen as clean. Give the fabric a second pass under
          raking light if the batch is high-value.
        </p>
      </div>
    );
  }

  // Most significant first — the server already sorts, but be explicit.
  const ordered = [...defects].sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return rank[a.severity] - rank[b.severity] || b.confidence - a.confidence;
  });

  return (
    <div className="findings">
      <ul className="defect-list">
        {ordered.map((defect, index) => (
          <li key={`${defect.label}-${index}`} className={`defect sev-${defect.severity}`}>
            <div className="defect-top">
              <span className="defect-name">{defect.label.replace(/_/g, " ")}</span>
              <span className={`badge sev-${defect.severity}`}>
                {SEVERITY_LABEL[defect.severity]}
              </span>
            </div>

            <div className="conf">
              <div className="conf-track" aria-hidden="true">
                <span
                  className="conf-fill"
                  style={{ width: `${Math.round(defect.confidence * 100)}%` }}
                />
              </div>
              <span className="conf-value">{Math.round(defect.confidence * 100)}%</span>
            </div>

            <div className="defect-meta">
              <span>{(defect.area_ratio * 100).toFixed(1)}% of frame</span>
              {defect.box && (
                <span>
                  at {Math.round(defect.box.x * 100)}%, {Math.round(defect.box.y * 100)}%
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <details className="taxonomy">
        <summary>Model taxonomy ({classes.length})</summary>
        <div className="tags">
          {classes.map((name) => (
            <span
              key={name}
              className={`tag ${defects.some((d) => d.label === name) ? "present" : ""}`}
            >
              {name.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
