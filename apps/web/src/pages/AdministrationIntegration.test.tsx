import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '../api/apiClient';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { RoutesPage } from './RoutesPage';
import { UsersPage } from './UsersPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const AUTH_VALUE: AuthContextValue = {
  status: 'authenticated',
  user: { userId: 'admin-1', fullName: 'Ada Admin', email: 'ada@warehouse.example', role: 'ADMIN', tenantId: 'tenant-1', tenantName: 'Warehouse' },
  sessionMessage: null,
  login: vi.fn(),
  logout: vi.fn(),
};

const EXISTING_ROUTE = {
  id: '22222222-2222-2222-2222-222222222222',
  code: 'R1',
  name: 'North Loop',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const NEW_ROUTE = {
  id: '44444444-4444-4444-4444-444444444444',
  code: 'R2',
  name: 'South Loop',
  active: true,
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

/**
 * Both pages share one `QueryClient`, exactly as they do inside the real
 * application shell — which is the whole point of this file: it proves the
 * two administration pages genuinely share route state through the query
 * cache, something neither page's own test file can observe in isolation.
 */
function renderBothAdminPages() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={AUTH_VALUE}>
        <MemoryRouter initialEntries={['/routes']}>
          <RoutesPage />
          <UsersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Administration pages share route state', () => {
  beforeEach(() => {
    resetApiClientForTests();
    setAccessToken('test-access-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a route created on the Routes page becomes selectable when assigning a driver, with no second lookup endpoint', async () => {
    // The backend's own state, so a refetch after the create genuinely
    // returns the new route rather than a hardcoded fixture.
    let routes = [EXISTING_ROUTE];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        const method = init?.method ?? 'GET';

        if (url.includes('/admin/routes') && method === 'POST') {
          routes = [...routes, NEW_ROUTE];
          return jsonResponse(201, NEW_ROUTE);
        }
        if (url.includes('/admin/routes')) {
          return jsonResponse(200, routes);
        }
        if (url.includes('/admin/users')) {
          return jsonResponse(200, []);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderBothAdminPages();
    await screen.findByText('R1');

    // Only the pre-existing route is offered at first.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    expect(within(screen.getByRole('dialog')).getByRole('option', { name: 'R1 — North Loop' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByRole('option', { name: /South Loop/ })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    });

    // Create the new route on the Routes page.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create route' }));
    });
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'R2' } });
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'South Loop' } });
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create route' }));
    });
    await waitFor(() => expect(screen.getByText('R2')).toBeInTheDocument());

    // It is immediately assignable in the user form — no page reload, and no
    // route lookup endpoint beyond the one GET /admin/routes both pages use.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('option', { name: 'R2 — South Loop' })).toBeInTheDocument());

    const routeLookupCalls = vi.mocked(fetch).mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      return url.includes('/admin/routes');
    });
    expect(routeLookupCalls.every(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      return new URL(url, 'http://localhost').pathname.endsWith('/admin/routes');
    })).toBe(true);
  });

  it('deactivating a route removes it from the assignable options for a new driver', async () => {
    let routes = [EXISTING_ROUTE];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        const method = init?.method ?? 'GET';

        if (url.includes('/admin/routes') && method === 'PUT') {
          routes = [{ ...EXISTING_ROUTE, active: false }];
          return jsonResponse(200, routes[0]);
        }
        if (url.includes('/admin/routes')) {
          return jsonResponse(200, routes);
        }
        if (url.includes('/admin/users')) {
          return jsonResponse(200, []);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderBothAdminPages();
    const row = (await screen.findByText('R1')).closest('tr') as HTMLElement;

    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Active' }));
    });
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }));
    });
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate route' }));
    });
    await waitFor(() => expect(within(row).getByText('Inactive')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    expect(within(screen.getByRole('dialog')).queryByRole('option', { name: /North Loop/ })).not.toBeInTheDocument();
  });
});
