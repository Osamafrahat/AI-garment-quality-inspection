import type { ChangeEvent, RefObject } from "react";

interface Props {
  file: File | null;
  previewUrl: string | null;
  loading: boolean;
  dragging: boolean;
  inputRef: RefObject<HTMLInputElement>;
  onSelect: (file: File) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({
  file,
  previewUrl,
  loading,
  dragging,
  inputRef,
  onSelect,
}: Props) {
  const openPicker = () => inputRef.current?.click();

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (picked) onSelect(picked);
    // Allow re-selecting the same file after a reset.
    event.target.value = "";
  };

  // Bundled demo images so the pipeline can be exercised without hunting for
  // a photo. Served from frontend/public/, so they ship with the app.
  const loadSample = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}`);
      const blob = await response.blob();
      onSelect(new File([blob], name, { type: blob.type || "image/jpeg" }));
    } catch (err) {
      console.error("Could not load sample image", err);
    }
  };

  return (
    <div className="upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="visually-hidden"
        aria-label="Choose a garment photo"
      />

      <button
        type="button"
        className={`dropzone ${dragging ? "dragging" : ""} ${file ? "compact" : ""}`}
        onClick={openPicker}
        disabled={loading}
      >
        {file && previewUrl ? (
          <>
            <img src={previewUrl} alt="" className="thumb" />
            <span className="dropzone-text">
              <strong>{file.name}</strong>
              <small>
                {formatBytes(file.size)} · click to choose another
              </small>
            </span>
          </>
        ) : (
          <span className="dropzone-text">
            <strong>Drop a garment photo here</strong>
            <small>or click to browse · JPEG, PNG, WebP · up to 20 MB</small>
          </span>
        )}
      </button>

      {!file && (
        <div className="sample-row">
          <span className="sample-label">or inspect a bundled sample:</span>
          <button
            type="button"
            className="link-btn"
            disabled={loading}
            onClick={() => void loadSample("/sample-hole.jpg", "sample-hole.jpg")}
          >
            defect
          </button>
          <button
            type="button"
            className="link-btn"
            disabled={loading}
            onClick={() => void loadSample("/sample-normal.jpg", "sample-normal.jpg")}
          >
            clean
          </button>
        </div>
      )}
    </div>
  );
}
