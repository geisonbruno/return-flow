/** Strips trailing slashes so callers can safely append a path starting with "/". */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Local development default: a same-origin relative path. The Vite dev
 * server proxies `/api/...` to `http://localhost:8080` (see
 * `vite.config.ts`), so the browser never needs the backend to grant CORS
 * for the web app's own origin. Deployment sets `VITE_API_BASE_URL` to the
 * API's real origin instead (see `.env.example`).
 */
const DEFAULT_API_BASE_URL = '/api/v1';

let cachedApiBaseUrl: string | undefined;

export function getApiBaseUrl(): string {
  if (cachedApiBaseUrl !== undefined) {
    return cachedApiBaseUrl;
  }
  const raw = import.meta.env.VITE_API_BASE_URL;
  const base = raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_API_BASE_URL;
  cachedApiBaseUrl = normalizeBaseUrl(base);
  return cachedApiBaseUrl;
}

/** Test-only: clears the memoized base URL so a test can simulate a fresh module load. */
export function resetApiBaseUrlForTests(): void {
  cachedApiBaseUrl = undefined;
}
