import type { InspectionResult } from "../types";

interface Props {
  previewUrl: string;
  result: InspectionResult | null;
  view: "overlay" | "annotated";
  loading: boolean;
}

/**
 * Shows the garment with detected regions drawn over it.
 *
 * In "overlay" mode the boxes are positioned client-side from the normalized
 * coordinates the API returned, which keeps them crisp at any zoom level. In
 * "annotated" mode we show the PNG the server rendered, as a cross-check that
 * backend localization matches what the UI computes.
 */
export function ImageViewer({ previewUrl, result, view, loading }: Props) {
  const useServerRender = view === "annotated" && Boolean(result?.annotated_image);
  const src = useServerRender ? result!.annotated_image! : previewUrl;
  const boxes = useServerRender ? [] : (result?.defects ?? []);

  return (
    <div className={`viewer ${loading ? "is-loading" : ""}`}>
      <img src={src} alt="Garment under inspection" />
      {loading && (
        <div className="viewer-overlay">
          <span className="spinner" aria-hidden="true" />
        </div>
      )}
      {!loading &&
        boxes.map((defect, index) =>
          defect.box ? (
            <div
              key={`${defect.label}-${index}`}
              className={`bbox sev-${defect.severity}`}
              style={{
                left: `${defect.box.x * 100}%`,
                top: `${defect.box.y * 100}%`,
                width: `${defect.box.w * 100}%`,
                height: `${defect.box.h * 100}%`,
              }}
              data-top={defect.box.y < 0.06}
              title={`${defect.label} · ${Math.round(defect.confidence * 100)}%`}
            >
              <span className="bbox-tag">
                {defect.label} · {Math.round(defect.confidence * 100)}%
              </span>
            </div>
          ) : null,
        )}
    </div>
  );
}
