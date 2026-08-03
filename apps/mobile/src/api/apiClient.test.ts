import * as SecureStore from 'expo-secure-store';

import { authorizedMultipartRequest, authorizedRequestJson, onSessionExpired, setSession } from './apiClient';

jest.mock('../config/environment', () => ({
  getApiBaseUrl: () => 'http://test-api.local',
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const REFRESHED_SESSION = { accessToken: 'new-access', refreshToken: 'new-refresh', accessTokenExpiresAt: '', tokenType: 'Bearer' };

describe('authorizedRequestJson', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    setSession(null);
  });

  it('attaches the current access token as a bearer token', async () => {
    setSession({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, []));

    await authorizedRequestJson('/api/v1/driver/returns');

    const [, init] = fetchSpy.mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('retries exactly once after a successful refresh, and the retry succeeds', async () => {
    setSession({ accessToken: 'expired', refreshToken: 'refresh-1' });
    let returnsCallCount = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return jsonResponse(200, REFRESHED_SESSION);
      }
      returnsCallCount += 1;
      return returnsCallCount === 1 ? jsonResponse(401, { title: 'Unauthorized' }) : jsonResponse(200, [{ id: '1' }]);
    });

    const result = await authorizedRequestJson('/api/v1/driver/returns');

    expect(result).toEqual([{ id: '1' }]);
    expect(returnsCallCount).toBe(2);
  });

  it('does not attempt a second retry — a request that still 401s after refresh fails outright', async () => {
    setSession({ accessToken: 'expired', refreshToken: 'refresh-1' });
    let returnsCallCount = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return jsonResponse(200, REFRESHED_SESSION);
      }
      returnsCallCount += 1;
      return jsonResponse(401, { title: 'Unauthorized' });
    });

    await expect(authorizedRequestJson('/api/v1/driver/returns')).rejects.toThrow();

    // Original attempt + exactly one retry, never more.
    expect(returnsCallCount).toBe(2);
  });

  it('shares one refresh call across concurrent 401s instead of starting a competing refresh for each', async () => {
    setSession({ accessToken: 'expired', refreshToken: 'refresh-1' });
    let refreshCallCount = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCallCount += 1;
        return jsonResponse(200, REFRESHED_SESSION);
      }
      return jsonResponse(401, { title: 'Unauthorized' });
    });

    const results = await Promise.allSettled([
      authorizedRequestJson('/api/v1/driver/returns'),
      authorizedRequestJson('/api/v1/driver/returns'),
    ]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(refreshCallCount).toBe(1);
  });

  it('persists a rotated token pair to SecureStore after a background refresh', async () => {
    setSession({ accessToken: 'expired', refreshToken: 'refresh-1' });
    let returnsCallCount = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return jsonResponse(200, REFRESHED_SESSION);
      }
      returnsCallCount += 1;
      return returnsCallCount === 1 ? jsonResponse(401, { title: 'Unauthorized' }) : jsonResponse(200, []);
    });

    await authorizedRequestJson('/api/v1/driver/returns');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.stringContaining('accessToken'), 'new-access');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.stringContaining('refreshToken'), 'new-refresh');
  });

  it('clears tokens and notifies the session-expired handler when refresh itself fails', async () => {
    setSession({ accessToken: 'expired', refreshToken: 'stale-refresh' });
    const expiredHandler = jest.fn();
    onSessionExpired(expiredHandler);
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return jsonResponse(401, { title: 'Invalid Refresh Token' });
      }
      return jsonResponse(401, { title: 'Unauthorized' });
    });

    await expect(authorizedRequestJson('/api/v1/driver/returns')).rejects.toThrow();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(expiredHandler).toHaveBeenCalledTimes(1);
  });

  it('never includes the access or refresh token value in a thrown error message', async () => {
    setSession({ accessToken: 'super-secret-access-token', refreshToken: 'super-secret-refresh-token' });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(401, { title: 'Unauthorized', detail: 'Invalid or expired refresh token.' }));

    let caught: unknown;
    try {
      await authorizedRequestJson('/api/v1/driver/returns');
    } catch (error) {
      caught = error;
    }

    const message = caught instanceof Error ? caught.message : String(caught);
    expect(message).not.toContain('super-secret-access-token');
    expect(message).not.toContain('super-secret-refresh-token');
  });
});

describe('authorizedMultipartRequest', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    setSession(null);
  });

  it('sends the FormData body as-is, without forcing a JSON Content-Type header', async () => {
    setSession({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(201, { id: 'photo-1' }));
    const formData = new FormData();
    formData.append('file', 'stand-in-file-value');

    await authorizedMultipartRequest('/api/v1/driver/returns/r1/photos', formData);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.body).toBe(formData);
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('retries exactly once after a successful refresh, same as the JSON path', async () => {
    setSession({ accessToken: 'expired', refreshToken: 'refresh-1' });
    let uploadCallCount = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return jsonResponse(200, REFRESHED_SESSION);
      }
      uploadCallCount += 1;
      return uploadCallCount === 1 ? jsonResponse(401, { title: 'Unauthorized' }) : jsonResponse(201, { id: 'photo-1' });
    });

    const result = await authorizedMultipartRequest('/api/v1/driver/returns/r1/photos', new FormData());

    expect(result).toEqual({ id: 'photo-1' });
    expect(uploadCallCount).toBe(2);
  });

  it('propagates a safe error when the upload fails outright', async () => {
    setSession({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(400, { title: 'Invalid Photo File', detail: 'The uploaded file must be a non-empty JPEG image.' }));

    await expect(authorizedMultipartRequest('/api/v1/driver/returns/r1/photos', new FormData())).rejects.toThrow();
  });
});
