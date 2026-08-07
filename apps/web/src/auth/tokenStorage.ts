/**
 * The refresh token is the only credential ever persisted by this app, and
 * only in `sessionStorage` (cleared when the browser tab/session closes) —
 * never `localStorage`. The access token lives in memory only (see
 * `api/apiClient.ts`) and is never written here. One narrowly named key,
 * not a generic "session" blob, so nothing else ever accidentally shares it.
 */
const REFRESH_TOKEN_KEY = 'returnflow.admin.refreshToken';

export function saveRefreshToken(token: string): void {
  try {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    // sessionStorage can be unavailable (e.g. some private-browsing modes);
    // treat as "nothing persisted" rather than crashing the login flow.
  }
}

export function loadRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearRefreshToken(): void {
  try {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Nothing to clear if storage access itself failed.
  }
}
