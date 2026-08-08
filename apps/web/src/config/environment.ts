/** Strips trailing slashes so callers can safely append a path starting with "/". */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * The backend's versioned API root. Every `contentPath` the backend returns
 * (`ReturnPhotoResponse`/`ReturnSignatureResponse`) is already a full path
 * starting with this exact prefix (see `AdminReturnService`'s
 * `toAdminPhotoResponse`/`toAdminSignatureResponse`) — not a path relative
 * to the configured API base the way every other endpoint path in this app
 * is. `toApiRelativePath` strips it back off so `contentPath` values can be
 * resolved through the exact same base-URL logic as everything else,
 * without ever producing a doubled `/api/v1/api/v1/...`.
 */
const API_VERSION_PATH = '/api/v1';

/**
 * Local development default: a same-origin relative path. The Vite dev
 * server proxies `/api/...` to `http://localhost:8080` (see
 * `vite.config.ts`), so the browser never needs the backend to grant CORS
 * for the web app's own origin. Deployment sets `VITE_API_BASE_URL` to the
 * API's real origin instead (see `.env.example`).
 */
const DEFAULT_API_BASE_URL = API_VERSION_PATH;

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

/**
 * A backend-provided `contentPath` (e.g.
 * `/api/v1/admin/returns/{id}/photos/{photoId}/content`) already includes
 * the versioned API root, so it must never be combined with
 * `getApiBaseUrl()` directly — that would produce
 * `/api/v1/api/v1/...` locally, or send the request to the wrong host
 * entirely once `VITE_API_BASE_URL` is an absolute deployment URL. Stripping
 * the known prefix first makes the result safe to pass through the exact
 * same request functions every other endpoint path already uses.
 */
export function toApiRelativePath(contentPath: string): string {
  return contentPath.startsWith(API_VERSION_PATH) ? contentPath.slice(API_VERSION_PATH.length) : contentPath;
}
