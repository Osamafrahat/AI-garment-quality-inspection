/** Types mirrored from the FastAPI schemas in `backend/app/schemas.py`. */

export type Severity = "low" | "medium" | "high" | "critical";

export type Verdict = "pass" | "review" | "fail";

/** Normalized to 0..1 with the origin at the image's top-left corner. */
export interface DefectBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Defect {
  label: string;
  severity: Severity;
  confidence: number;
  box: DefectBox | null;
  /** Fraction of the image the defect covers. */
  area_ratio: number;
}

export interface ModelInfo {
  loaded: boolean;
  trained: boolean;
  /** "inference" when serving real weights, "demo" for placeholder output. */
  mode: "inference" | "demo";
  device: string;
  classes: string[];
  input_size: number;
  weights_path: string;
  torch_available: boolean;
}

export interface InspectionResult {
  verdict: Verdict;
  quality_score: number;
  defects: Defect[];
  /** Base64 PNG data URI rendered server-side with boxes drawn on it. */
  annotated_image: string | null;
  model: ModelInfo;
  inference_ms: number;
}

export interface HealthStatus {
  status: string;
  app: string;
  environment: string;
  model_ready: boolean;
}
