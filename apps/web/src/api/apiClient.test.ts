import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from '../auth/tokenStorage';
import {
  authorizedRequestJson,
  clearSession,
  requestJson,
  resetApiClientForTests,
  setAccessToken,
} from './apiClient';
import { ApiError } from './problemDetail';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('apiClient', () => {
  beforeEach(() => {
    resetApiClientForTests();
    clearRefreshToken();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the bearer token on an authorized request', async () => {
    setAccessToken('access-token-1');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await authorizedRequestJson('/admin/dashboard/summary');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-token-1');
  });

  it('performs exactly one refresh-and-retry after a 401, then succeeds', async () => {
    setAccessToken('expired-access-token');
    saveRefreshToken('refresh-token-1');

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Invalid or expired access token.' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: 'new-access-token',
          accessTokenExpiresAt: '2026-01-01T00:00:00Z',
          refreshToken: 'rotated-refresh-token',
          tokenType: 'Bearer',
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await authorizedRequestJson<{ ok: boolean }>('/admin/dashboard/summary');

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    // The rotated refresh token is persisted, not just held in memory.
    expect(loadRefreshToken()).toBe('rotated-refresh-token');
    // The retried request used the new access token.
    const retryInit = vi.mocked(fetch).mock.calls[2][1];
    const retryHeaders = retryInit?.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new-access-token');
  });

  it('deduplicates concurrent 401s into a single refresh call', async () => {
    setAccessToken('expired-access-token');
    saveRefreshToken('refresh-token-1');

    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: 'new-access-token',
            accessTokenExpiresAt: '2026-01-01T00:00:00Z',
            refreshToken: 'rotated-refresh-token',
            tokenType: 'Bearer',
          }),
        );
      }
      const authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (authHeader === 'Bearer new-access-token') {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      // Both concurrent callers still hold the stale token on their first attempt.
      return Promise.resolve(jsonResponse(401, {}));
    });

    const [first, second] = await Promise.all([
      authorizedRequestJson<{ ok: boolean }>('/admin/returns'),
      authorizedRequestJson<{ ok: boolean }>('/admin/returns'),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    const refreshCalls = vi.mocked(fetch).mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      return url.includes('/auth/refresh');
    });
    expect(refreshCalls).toHaveLength(1);
  });

  it('clears the session and does not loop when refresh itself fails', async () => {
    setAccessToken('expired-access-token');
    saveRefreshToken('refresh-token-1');
    const expiredHandler = vi.fn();
    const { onSessionExpired } = await import('./apiClient');
    onSessionExpired(expiredHandler);

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Invalid or expired refresh token.' }));

    await expect(authorizedRequestJson('/admin/returns')).rejects.toBeInstanceOf(ApiError);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(expiredHandler).toHaveBeenCalledTimes(1);
    expect(loadRefreshToken()).toBeNull();
  });

  it('converts a ProblemDetail error response into an ApiError without throwing a raw fetch error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(400, { title: 'Invalid Filter', detail: 'Bad request.' }));

    await expect(requestJson('/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } })).rejects.toMatchObject({
      status: 400,
      problem: { detail: 'Bad request.' },
    });
  });

  it('clearSession() clears both the in-memory access token and the persisted refresh token', async () => {
    setAccessToken('token');
    saveRefreshToken('refresh');
    clearSession();

    expect(loadRefreshToken()).toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, {}));
    await expect(authorizedRequestJson('/admin/returns')).rejects.toThrow('No authenticated session.');
  });
});
