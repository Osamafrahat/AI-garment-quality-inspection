import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { inspectImage, fetchHealth, fetchModel } from "./api/client";
import type { HealthStatus, InspectionResult, ModelInfo } from "./types";
import { DefectList } from "./components/DefectList";
import { ImageViewer } from "./components/ImageViewer";
import { ModelBanner } from "./components/ModelBanner";
import { UploadZone } from "./components/UploadZone";
import { VerdictBanner } from "./components/VerdictBanner";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];

export default function App() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<InspectionResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"overlay" | "annotated">("overlay");
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read backend state once on mount so the header and demo banner are accurate.
  useEffect(() => {
    let cancelled = false;
    fetchModel()
      .then((info) => !cancelled && setModel(info))
      .catch(() => {
        /* the inspect call will surface a clearer error if the API is down */
      });
    fetchHealth()
      .then((status) => !cancelled && setHealth(status))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke the previous object URL when the preview changes or unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const runInspection = useCallback(async (next: File) => {
    if (!ACCEPTED.includes(next.type) && !/\.(jpe?g|png|webp|bmp|tiff?)$/i.test(next.name)) {
      setError("Please choose a JPEG, PNG, WebP, BMP, or TIFF image.");
      return;
    }
    if (next.size > 20 * 1024 * 1024) {
      setError("That image is larger than the 20 MB limit.");
      return;
    }

    setFile(next);
    setResult(null);
    setError(null);
    setView("overlay");
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(next);
    });

    setLoading(true);
    try {
      const inspected = await inspectImage(next);
      setResult(inspected);
      setModel(inspected.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspection failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) void runInspection(dropped);
    },
    [runInspection],
  );

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>ThreadSight</h1>
            <p>AI garment quality inspection</p>
          </div>
        </div>
        {health && (
          <div className={`conn-dot ${health.model_ready ? "ready" : "demo"}`}>
            {health.model_ready ? "Model loaded" : "Demo mode"}
          </div>
        )}
      </header>

      {model && <ModelBanner model={model} />}

      {error && (
        <div className="alert" role="alert">
          <strong>Something went wrong.</strong> {error}
        </div>
      )}

      <main className="layout">
        <section className="panel">
          <div className="panel-head">
            <h2>1 · Specimen</h2>
            {file && (
              <button type="button" className="link-btn" onClick={reset}>
                Clear
              </button>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <UploadZone
              file={file}
              previewUrl={previewUrl}
              loading={loading}
              dragging={dragging}
              inputRef={fileInputRef}
              onSelect={(f) => void runInspection(f)}
            />
          </div>

          {previewUrl && (
            <div className="viewer-toolbar">
              <div className="segmented" role="group" aria-label="Preview mode">
                <button
                  type="button"
                  className={view === "overlay" ? "active" : ""}
                  onClick={() => setView("overlay")}
                  disabled={!result}
                >
                  Live overlay
                </button>
                <button
                  type="button"
                  className={view === "annotated" ? "active" : ""}
                  onClick={() => setView("annotated")}
                  disabled={!result?.annotated_image}
                >
                  Server render
                </button>
              </div>
              {result && (
                <span className="meta">{result.inference_ms.toFixed(1)} ms</span>
              )}
            </div>
          )}

          {previewUrl && (
            <ImageViewer
              previewUrl={previewUrl}
              result={result}
              view={view}
              loading={loading}
            />
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>2 · Findings</h2>
          </div>

          {!result && !loading && (
            <div className="empty">
              <p>Upload a garment photo to run an inspection.</p>
              <p className="empty-hint">
                The classifier returns a defect class, a confidence, a severity tier, and a
                bounding box localized from a Grad-CAM heatmap.
              </p>
            </div>
          )}

          {loading && (
            <div className="loading">
              <span className="spinner" aria-hidden="true" />
              <p>Analysing fabric…</p>
            </div>
          )}

          {result && !loading && (
            <>
              <VerdictBanner result={result} />
              <DefectList defects={result.defects} classes={result.model.classes} />
            </>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>Backend API docs at <code>/docs</code></span>
        <span>
          {model
            ? `${model.classes.length} classes · ${model.input_size}px input · ${model.device}`
            : "connecting…"}
        </span>
      </footer>
    </div>
  );
}
