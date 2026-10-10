/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the API origin in deployments where the backend is not proxied. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
