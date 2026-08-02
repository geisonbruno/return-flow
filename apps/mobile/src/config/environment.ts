/** Strips trailing slashes so callers can safely append a path starting with "/". */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

let cachedApiBaseUrl: string | undefined;

/**
 * Reads {@code EXPO_PUBLIC_API_BASE_URL}, set in `.env` (see `.env.example`).
 * Expo inlines `EXPO_PUBLIC_*` variables into the JS bundle at build time, so
 * this is safe to read from `process.env` directly, but it is never a secret
 * — it's just the API's own address.
 */
export function getApiBaseUrl(): string {
  if (cachedApiBaseUrl !== undefined) {
    return cachedApiBaseUrl;
  }
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not set. Copy apps/mobile/.env.example to .env and set it to your ' +
        "backend's address (see the mobile README for physical-device setup).",
    );
  }
  cachedApiBaseUrl = normalizeBaseUrl(raw.trim());
  return cachedApiBaseUrl;
}

/** Test-only: clears the memoized base URL so a test can simulate a fresh app start. */
export function resetApiBaseUrlForTests(): void {
  cachedApiBaseUrl = undefined;
}
