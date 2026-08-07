import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests } from '../api/apiClient';
import { AuthProvider, useAuth } from './AuthContext';
import { loadRefreshToken, saveRefreshToken } from './tokenStorage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function allStorageValues(storage: Storage): string[] {
  const values: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null) {
      values.push(storage.getItem(key) ?? '');
    }
  }
  return values;
}

const ADMIN_USER = {
  userId: 'user-1',
  fullName: 'Ada Admin',
  email: 'ada@warehouse.example',
  role: 'ADMIN',
  tenantId: 'tenant-1',
  tenantName: 'Warehouse',
};

const DRIVER_USER = { ...ADMIN_USER, role: 'DRIVER', fullName: 'Dana Driver' };

const ADMIN_SESSION = {
  accessToken: 'access-token-1',
  accessTokenExpiresAt: '2026-01-01T00:00:00Z',
  refreshToken: 'refresh-token-1',
  tokenType: 'Bearer',
};

function TestHarness() {
  const { status, user, sessionMessage, login, logout } = useAuth();
  const queryClient = useQueryClient();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user">{user?.fullName ?? ''}</div>
      <div data-testid="session-message">{sessionMessage ?? ''}</div>
      <div data-testid="query-cache-size">{queryClient.getQueryCache().getAll().length}</div>
      <button onClick={() => login('ada@warehouse.example', 'password123').catch(() => undefined)}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderAuth() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    resetApiClientForTests();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('session restoration', () => {
    it('becomes unauthenticated with no stored refresh token', async () => {
      vi.stubGlobal('fetch', vi.fn());
      renderAuth();

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
      expect(fetch).not.toHaveBeenCalled();
    });

    it('restores an ADMIN session from a stored refresh token without ever showing "unauthenticated"', async () => {
      saveRefreshToken('stored-refresh-token');
      const statusesSeen: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : (input as Request).url;
          if (url.includes('/auth/refresh')) {
            return jsonResponse(200, { ...ADMIN_SESSION, refreshToken: 'rotated-refresh-token' });
          }
          if (url.includes('/auth/me')) {
            return jsonResponse(200, ADMIN_USER);
          }
          throw new Error(`Unexpected request: ${url}`);
        }),
      );

      render(
        <QueryClientProvider client={new QueryClient()}>
          <AuthProvider>
            <StatusRecorder onStatus={(s) => statusesSeen.push(s)} />
          </AuthProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
      expect(screen.getByTestId('user')).toHaveTextContent('Ada Admin');
      // Never observed 'unauthenticated' — restoration went straight from 'restoring' to 'authenticated'.
      expect(statusesSeen).not.toContain('unauthenticated');
      // The rotated refresh token (not the original) is what got persisted.
      expect(loadRefreshToken()).toBe('rotated-refresh-token');
    });

    it('clears the session when the refresh call itself fails', async () => {
      saveRefreshToken('stored-refresh-token');
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse(401, { detail: 'Invalid or expired refresh token.' })),
      );

      renderAuth();

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
      expect(loadRefreshToken()).toBeNull();
    });

    it('clears the session when /auth/me fails after a successful refresh', async () => {
      saveRefreshToken('stored-refresh-token');
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : (input as Request).url;
          if (url.includes('/auth/refresh')) {
            return jsonResponse(200, ADMIN_SESSION);
          }
          return jsonResponse(500, {});
        }),
      );

      renderAuth();

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
      expect(loadRefreshToken()).toBeNull();
    });

    it('rejects a restored non-ADMIN session', async () => {
      saveRefreshToken('stored-refresh-token');
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : (input as Request).url;
          if (url.includes('/auth/refresh')) {
            return jsonResponse(200, ADMIN_SESSION);
          }
          if (url.includes('/auth/me')) {
            return jsonResponse(200, DRIVER_USER);
          }
          throw new Error(`Unexpected request: ${url}`);
        }),
      );

      renderAuth();

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
      expect(screen.getByTestId('user')).toHaveTextContent('');
      expect(loadRefreshToken()).toBeNull();
    });
  });

  describe('login', () => {
    it('logs an ADMIN in, storing only the refresh token in sessionStorage', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : (input as Request).url;
          if (url.includes('/auth/login')) {
            return jsonResponse(200, ADMIN_SESSION);
          }
          if (url.includes('/auth/me')) {
            return jsonResponse(200, ADMIN_USER);
          }
          throw new Error(`Unexpected request: ${url}`);
        }),
      );

      renderAuth();
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));

      await act(async () => {
        screen.getByText('Login').click();
      });

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
      expect(screen.getByTestId('user')).toHaveTextContent('Ada Admin');
      expect(loadRefreshToken()).toBe('refresh-token-1');
      // The access token is never written to sessionStorage or localStorage —
      // only the (distinct) refresh-token string is ever persisted.
      expect(allStorageValues(sessionStorage)).not.toContain(ADMIN_SESSION.accessToken);
      expect(allStorageValues(localStorage)).not.toContain(ADMIN_SESSION.accessToken);
      expect(localStorage.length).toBe(0);
    });

    it('rejects a non-ADMIN login, clearing any partial session', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : (input as Request).url;
          if (url.includes('/auth/login')) {
            return jsonResponse(200, ADMIN_SESSION);
          }
          if (url.includes('/auth/me')) {
            return jsonResponse(200, DRIVER_USER);
          }
          if (url.includes('/auth/logout')) {
            return new Response(null, { status: 204 });
          }
          throw new Error(`Unexpected request: ${url}`);
        }),
      );

      renderAuth();
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));

      await act(async () => {
        screen.getByText('Login').click();
      });

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
      expect(loadRefreshToken()).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears local session and the TanStack Query cache, even if the network logout call fails', async () => {
      saveRefreshToken('stored-refresh-token');
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : (input as Request).url;
          if (url.includes('/auth/refresh')) {
            return jsonResponse(200, ADMIN_SESSION);
          }
          if (url.includes('/auth/me')) {
            return jsonResponse(200, ADMIN_USER);
          }
          if (url.includes('/auth/logout')) {
            throw new TypeError('Network request failed');
          }
          throw new Error(`Unexpected request: ${url}`);
        }),
      );

      renderAuth();
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

      await act(async () => {
        screen.getByText('Logout').click();
      });

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
      expect(screen.getByTestId('user')).toHaveTextContent('');
      expect(loadRefreshToken()).toBeNull();
      expect(screen.getByTestId('query-cache-size')).toHaveTextContent('0');
    });
  });
});

function StatusRecorder({ onStatus }: { onStatus: (status: string) => void }) {
  const { status, user, sessionMessage } = useAuth();
  onStatus(status);
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user">{user?.fullName ?? ''}</div>
      <div data-testid="session-message">{sessionMessage ?? ''}</div>
    </div>
  );
}
