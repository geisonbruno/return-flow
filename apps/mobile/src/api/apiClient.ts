import { getApiBaseUrl } from '../config/environment';
import { clearTokens, saveTokens } from '../auth/tokenStorage';
import type { AuthSession } from '../auth/types';
import { ApiError } from './problemDetails';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /**
   * When true, `body` is sent as-is (expected to already be a `FormData`)
   * and no `Content-Type` header is set — the platform's `fetch` must be
   * left to generate its own `multipart/form-data; boundary=...` header.
   * Manually setting `Content-Type: multipart/form-data` without the
   * boundary the platform actually used would make the server unable to
   * parse the request at all.
   */
  multipart?: boolean;
}

/**
 * Only the two fields this module actually needs — deliberately not the
 * full {@link AuthSession} DTO, so callers restoring a session from storage
 * (which only persists these two values) never have to invent placeholder
 * values for the fields the client doesn't use.
 */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

let currentSession: SessionTokens | null = null;
let refreshInFlight: Promise<AuthSession> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

/** Called by {@code AuthContext} whenever the session changes (login, refresh, logout). */
export function setSession(session: SessionTokens | null): void {
  currentSession = session;
}

/**
 * Registered once by {@code AuthContext} so a background refresh failure
 * (triggered by any authenticated screen's API call, not just an explicit
 * user action) can still clear React state and return to Login.
 */
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

async function toUrl(path: string): Promise<string> {
  return `${getApiBaseUrl()}${path}`;
}

async function rawRequest<T>(path: string, options: RequestOptions, accessToken?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(await toUrl(path), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.multipart ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.multipart
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
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
  return (await response.json()) as T;
}

/** Unauthenticated JSON request — used for login/refresh/logout, none of which carry a bearer token. */
export function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return rawRequest<T>(path, options);
}

/** The single place that calls the refresh endpoint — both the proactive session bootstrap and the reactive 401 retry below funnel through this. */
export function refreshSession(refreshToken: string): Promise<AuthSession> {
  return rawRequest<AuthSession>('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } });
}

function refreshOnce(): Promise<AuthSession> {
  if (!currentSession) {
    return Promise.reject(new Error('No session to refresh.'));
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshSession(currentSession.refreshToken).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Authenticated JSON request. On a 401 (expired/invalid access token), tries
 * exactly one refresh-and-retry: concurrent callers hitting a 401 at the
 * same time share one in-flight refresh (see {@link refreshOnce}) instead of
 * each starting their own. If the refresh itself fails, or the retried
 * request still 401s, the session is treated as unrecoverable.
 *
 * <p>A successful background refresh is persisted to SecureStore immediately
 * (not just kept in memory) — otherwise a rotation triggered deep inside a
 * screen's API call would silently leave the on-device tokens stale, and a
 * later app restart would try to resume with an already-superseded refresh
 * token.
 */
async function authorizedRequest<T>(path: string, options: RequestOptions, retried = false): Promise<T> {
  if (!currentSession) {
    throw new Error('No authenticated session.');
  }
  try {
    return await rawRequest<T>(path, options, currentSession.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || retried) {
      throw error;
    }
    try {
      const refreshed = await refreshOnce();
      setSession(refreshed);
      await saveTokens(refreshed);
      return await authorizedRequest<T>(path, options, true);
    } catch (refreshError) {
      setSession(null);
      await clearTokens();
      sessionExpiredHandler?.();
      throw refreshError;
    }
  }
}

export function authorizedRequestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return authorizedRequest<T>(path, options);
}

/**
 * Authenticated multipart upload — shares the exact same de-duplicated
 * refresh-and-retry-once behavior as {@link authorizedRequestJson} (see
 * {@link authorizedRequest}), just with a `FormData` body and no
 * `Content-Type` header forced onto the request (see {@link RequestOptions.multipart}).
 */
export function authorizedMultipartRequest<T>(path: string, formData: FormData): Promise<T> {
  return authorizedRequest<T>(path, { method: 'POST', body: formData, multipart: true });
}
