import { getApiBaseUrl } from '../config/environment';
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from '../auth/tokenStorage';
import type { AuthSession } from '../auth/types';
import { ApiError } from './problemDetail';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Reads the response body as a `Blob` instead of JSON — for future authenticated media downloads (Phase 6B2+). */
  responseType?: 'json' | 'blob';
}

/**
 * The access token lives only here, in a module-level variable — never in
 * `localStorage`/`sessionStorage`, never in a cookie, never rendered into
 * markup. A page reload always loses it, which is intentional: session
 * restoration re-derives it from the persisted refresh token (see
 * `auth/AuthContext.tsx`).
 */
let accessToken: string | null = null;
let refreshInFlight: Promise<AuthSession> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Clears the in-memory access token and the persisted refresh token together — the one place "no session" is established. */
export function clearSession(): void {
  accessToken = null;
  clearRefreshToken();
}

/** Registered once by `AuthContext` so a background refresh failure (triggered by any authenticated screen's API call) can still clear React state and return to Login. */
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

function toUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

async function rawRequest<T>(path: string, options: RequestOptions, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(toUrl(path), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw ApiError.network();
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  if (options.responseType === 'blob') {
    return (await response.blob()) as T;
  }
  return (await response.json()) as T;
}

/** Unauthenticated JSON request — used for login/refresh/logout, none of which carry a bearer token. */
export function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return rawRequest<T>(path, options);
}

/** The single place that calls the refresh endpoint — both proactive session restoration and the reactive 401 retry below funnel through this. */
export function refreshSession(refreshToken: string): Promise<AuthSession> {
  return rawRequest<AuthSession>('/auth/refresh', { method: 'POST', body: { refreshToken } });
}

function refreshOnce(): Promise<AuthSession> {
  const currentRefreshToken = loadRefreshToken();
  if (!currentRefreshToken) {
    return Promise.reject(new Error('No session to refresh.'));
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshSession(currentRefreshToken).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Authenticated JSON/blob request. On a 401 (expired/invalid access token),
 * tries exactly one refresh-and-retry: concurrent callers hitting a 401 at
 * the same time share one in-flight refresh (see {@link refreshOnce})
 * instead of each starting their own. If the refresh itself fails, or the
 * retried request still 401s, the session is treated as unrecoverable.
 *
 * <p>A successful background refresh is persisted to `sessionStorage`
 * immediately (not just kept in memory) — otherwise a rotation triggered
 * deep inside a screen's API call would silently leave the persisted
 * refresh token stale, and a later page reload would try to resume with an
 * already-superseded one.
 */
async function authorizedRequest<T>(path: string, options: RequestOptions, retried = false): Promise<T> {
  if (!accessToken) {
    throw new Error('No authenticated session.');
  }
  try {
    return await rawRequest<T>(path, options, accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || retried) {
      throw error;
    }
    try {
      const refreshed = await refreshOnce();
      accessToken = refreshed.accessToken;
      saveRefreshToken(refreshed.refreshToken);
      return await authorizedRequest<T>(path, options, true);
    } catch (refreshError) {
      clearSession();
      sessionExpiredHandler?.();
      throw refreshError;
    }
  }
}

export function authorizedRequestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return authorizedRequest<T>(path, options);
}

/**
 * Authenticated binary media fetch (return photos, the rendered customer
 * signature) — shares the exact same bearer-token attachment and
 * refresh-and-retry-once behavior as {@link authorizedRequestJson}, just
 * reading the response body as a `Blob` instead of JSON. `path` must
 * already be relative to the configured API base — resolve a
 * backend-provided `contentPath` with `config/environment.ts`'s
 * `toApiRelativePath` first.
 */
export function authorizedRequestBlob(path: string): Promise<Blob> {
  return authorizedRequest<Blob>(path, { responseType: 'blob' });
}

/** Test-only: resets every module-level singleton so tests don't leak state into each other. */
export function resetApiClientForTests(): void {
  accessToken = null;
  refreshInFlight = null;
  sessionExpiredHandler = null;
}
