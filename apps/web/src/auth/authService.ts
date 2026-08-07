import { authorizedRequestJson, refreshSession, requestJson } from '../api/apiClient';
import type { AuthSession, AuthenticatedUser } from './types';

/** Mirrors the backend's `user.EmailNormalizer` (trim + lowercase) — the backend re-normalizes anyway, this is UX only. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function login(email: string, password: string): Promise<AuthSession> {
  return requestJson<AuthSession>('/auth/login', { method: 'POST', body: { email: normalizeEmail(email), password } });
}

/** Re-exported from the API client so callers only ever need one "auth operations" module. */
export function refresh(refreshToken: string): Promise<AuthSession> {
  return refreshSession(refreshToken);
}

/**
 * Best-effort: the backend call revokes the refresh-token session, but an
 * ADMIN must always be able to leave the app locally even if the network
 * request fails, so this never rejects.
 */
export async function logout(refreshToken: string): Promise<void> {
  try {
    await requestJson<void>('/auth/logout', { method: 'POST', body: { refreshToken } });
  } catch {
    // Best-effort — the caller always clears local session state regardless.
  }
}

export function getCurrentUser(): Promise<AuthenticatedUser> {
  return authorizedRequestJson<AuthenticatedUser>('/auth/me');
}
