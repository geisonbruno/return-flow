import { render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { resetApiClientForTests } from './api/apiClient';
import { saveRefreshToken } from './auth/tokenStorage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ADMIN_SESSION = {
  accessToken: 'access-token-1',
  accessTokenExpiresAt: '2026-01-01T00:00:00Z',
  refreshToken: 'refresh-token-1',
  tokenType: 'Bearer',
};

const ADMIN_USER = {
  userId: 'user-1',
  fullName: 'Ada Admin',
  email: 'ada@warehouse.example',
  role: 'ADMIN',
  tenantId: 'tenant-1',
  tenantName: 'Warehouse',
};

const EMPTY_PAGE = { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 };

/**
 * Stubs fetch to satisfy the restore-session flow (refresh + /auth/me) plus
 * the Dashboard's own data calls, so these routing regression tests render
 * a realistic authenticated app instead of leaving Dashboard's queries to
 * fail with "unexpected request" on every render that happens to land on
 * `/dashboard`. Dashboard/Returns *behavior* itself is covered by their own
 * dedicated test files, not here.
 */
function stubAuthenticatedFetch() {
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
        return new Response(null, { status: 204 });
      }
      if (url.includes('/admin/dashboard/summary')) {
        return jsonResponse(200, { waitingWarehouse: 0, inReview: 0, closedToday: 0, returnsToday: 0 });
      }
      if (url.includes('/admin/returns')) {
        return jsonResponse(200, EMPTY_PAGE);
      }
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
}

describe('App routing', () => {
  beforeEach(() => {
    resetApiClientForTests();
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects an unauthenticated visit to a protected route to /login, preserving the destination', async () => {
    window.history.pushState({}, '', '/returns');
    vi.stubGlobal('fetch', vi.fn());

    render(<App />);

    await waitFor(() => expect(screen.getByText('Admin sign in')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/login');
  });

  it('restores an ADMIN session and shows the authenticated shell, never flashing the login form', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', '/dashboard');
    stubAuthenticatedFetch();

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument());
    expect(screen.queryByText('Admin sign in')).not.toBeInTheDocument();
  });

  it('redirects an authenticated ADMIN away from /login to /dashboard', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', '/login');
    stubAuthenticatedFetch();

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument());
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('shows a Not Found page for an unknown route once authenticated', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', '/no-such-page');
    stubAuthenticatedFetch();

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument());
  });

  it('renders shell navigation for all four sections once authenticated', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', '/dashboard');
    stubAuthenticatedFetch();

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument());
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Returns' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Routes' })).toBeInTheDocument();
  });

  it('logs out and redirects back to /login', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', '/dashboard');
    stubAuthenticatedFetch();

    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument());

    await act(async () => {
      screen.getByRole('button', { name: 'Log out' }).click();
    });

    await waitFor(() => expect(screen.getByText('Admin sign in')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/login');
  });
});
