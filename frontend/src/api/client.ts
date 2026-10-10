import type { HealthStatus, InspectionResult, ModelInfo } from "../types";

/** Same-origin by default thanks to the Vite proxy; override at build time. */
const BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** FastAPI errors come back as `{"detail": "..."}` — surface that, not "[object Object]". */
async function toError(response: Response): Promise<ApiError> {
  let detail = `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      detail = body.detail;
    }
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  return new ApiError(detail, response.status);
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) throw await toError(response);
  return (await response.json()) as T;
}

export function fetchHealth(): Promise<HealthStatus> {
  return get<HealthStatus>("/health");
}

export function fetchModel(): Promise<ModelInfo> {
  return get<ModelInfo>("/model");
}

export async function inspectImage(file: File): Promise<InspectionResult> {
  const form = new FormData();
  form.append("file", file, file.name);

  const response = await fetch(`${BASE}/inspect`, { method: "POST", body: form });
  if (!response.ok) throw await toError(response);
  return (await response.json()) as InspectionResult;
}
