import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const RETURN_DETAIL = {
  id: '33333333-3333-3333-3333-333333333333',
  returnNumber: 'RF-000099',
  status: 'AWAITING_WAREHOUSE',
  customerName: 'Acme',
  productName: 'Widget',
  quantity: 1,
  unit: 'EA',
  reason: 'DAMAGED',
  reasonDetails: null,
  observation: null,
  driver: { id: 'd1', fullName: 'Dana Driver' },
  route: { id: 'rt1', code: 'R1', name: 'North Loop', active: true },
  photos: [] as unknown[],
  signature: null as unknown,
  createdAt: '2026-08-06T02:15:00Z',
  updatedAt: '2026-08-06T02:15:00Z',
};

/** In review, owned by the authenticated ADMIN — used by the nav-guard test below to exercise the real editable warehouse-review form. */
const RETURN_DETAIL_IN_REVIEW = {
  ...RETURN_DETAIL,
  status: 'IN_REVIEW',
  reviewer: { id: ADMIN_USER.userId, fullName: ADMIN_USER.fullName },
  reviewStartedAt: '2026-08-06T04:00:00Z',
};

const RETURN_LIST_ITEM = {
  id: RETURN_DETAIL.id,
  returnNumber: RETURN_DETAIL.returnNumber,
  customerName: RETURN_DETAIL.customerName,
  productName: RETURN_DETAIL.productName,
  quantity: RETURN_DETAIL.quantity,
  unit: RETURN_DETAIL.unit,
  reason: RETURN_DETAIL.reason,
  status: RETURN_DETAIL.status,
  driver: RETURN_DETAIL.driver,
  route: RETURN_DETAIL.route,
  createdAt: RETURN_DETAIL.createdAt,
  photoCount: 0,
  hasSignature: false,
};

/** Like {@link stubAuthenticatedFetch}, extended with a real return detail and (optionally) that return appearing in the Returns list — for the navigation tests below. */
function stubAuthenticatedFetchWithReturn(options: { inReturnsList?: boolean; detail?: typeof RETURN_DETAIL } = {}) {
  const detail = options.detail ?? RETURN_DETAIL;
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
      if (url.includes(`/admin/returns/${RETURN_DETAIL.id}`)) {
        return jsonResponse(200, detail);
      }
      if (url.includes('/admin/users') || url.includes('/admin/routes')) {
        return jsonResponse(200, []);
      }
      if (url.includes('/admin/returns')) {
        const content = options.inReturnsList ? [RETURN_LIST_ITEM] : [];
        return jsonResponse(200, { ...EMPTY_PAGE, content, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0 });
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

  it('renders Return Details directly at /returns/:returnId', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', `/returns/${RETURN_DETAIL.id}`);
    stubAuthenticatedFetchWithReturn();

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: RETURN_DETAIL.returnNumber })).toBeInTheDocument());
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('preserves Returns filter state in browser history when navigating to Return Details and back', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', '/returns?status=AWAITING_WAREHOUSE');
    stubAuthenticatedFetchWithReturn({ inReturnsList: true });

    render(<App />);
    await waitFor(() => expect(screen.getByRole('link', { name: RETURN_DETAIL.returnNumber })).toBeInTheDocument());

    await act(async () => {
      screen.getByRole('link', { name: RETURN_DETAIL.returnNumber }).click();
    });
    await waitFor(() => expect(window.location.pathname).toBe(`/returns/${RETURN_DETAIL.id}`));

    await act(async () => {
      window.history.back();
    });

    await waitFor(() => expect(window.location.pathname).toBe('/returns'));
    expect(window.location.search).toBe('?status=AWAITING_WAREHOUSE');
  });

  it('AppShell nav links ask for confirmation when the warehouse review form has unsaved values, and only navigate once confirmed', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', `/returns/${RETURN_DETAIL.id}`);
    stubAuthenticatedFetchWithReturn({ detail: RETURN_DETAIL_IN_REVIEW });

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Warehouse representative name')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Warehouse representative name'), { target: { value: 'Wes Warehouse' } });

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await act(async () => {
      within(nav).getByRole('link', { name: 'Returns' }).click();
    });

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText('Unsaved review information will be discarded.')).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/returns/${RETURN_DETAIL.id}`);

    await act(async () => {
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Leave' }).click();
    });

    await waitFor(() => expect(window.location.pathname).toBe('/returns'));
  });

  it('a nav-link navigation with no unsaved review values proceeds immediately, without a confirmation dialog', async () => {
    saveRefreshToken('stored-refresh-token');
    window.history.pushState({}, '', `/returns/${RETURN_DETAIL.id}`);
    stubAuthenticatedFetchWithReturn({ detail: RETURN_DETAIL_IN_REVIEW });

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Warehouse representative name')).toBeInTheDocument());

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await act(async () => {
      within(nav).getByRole('link', { name: 'Dashboard' }).click();
    });

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
