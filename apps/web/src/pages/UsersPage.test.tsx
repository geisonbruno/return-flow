import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '../api/apiClient';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { UsersPage } from './UsersPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ME_ID = 'admin-1';
const OTHER_ADMIN_ID = 'admin-2';
const DRIVER_ID = 'driver-1';
const ROUTE_ID = '22222222-2222-2222-2222-222222222222';
const INACTIVE_ROUTE_ID = '33333333-3333-3333-3333-333333333333';

const AUTH_VALUE: AuthContextValue = {
  status: 'authenticated',
  user: { userId: ME_ID, fullName: 'Ada Admin', email: 'ada@warehouse.example', role: 'ADMIN', tenantId: 'tenant-1', tenantName: 'Warehouse' },
  sessionMessage: null,
  login: vi.fn(),
  logout: vi.fn(),
};

const ACTIVE_ROUTE = { id: ROUTE_ID, code: 'R1', name: 'North Loop', active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const INACTIVE_ROUTE = { id: INACTIVE_ROUTE_ID, code: 'R9', name: 'Retired Loop', active: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };

const ADMIN_USER = {
  id: OTHER_ADMIN_ID,
  name: 'Bob Admin',
  email: 'bob@warehouse.example',
  role: 'ADMIN',
  active: true,
  route: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const DRIVER_USER = {
  id: DRIVER_ID,
  name: 'Dana Driver',
  email: 'dana@warehouse.example',
  role: 'DRIVER',
  active: true,
  route: { id: ROUTE_ID, code: 'R1', name: 'North Loop', active: true },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

interface StubOptions {
  users?: unknown[];
  routes?: unknown[];
  onCreateUser?: (body: unknown) => Response;
  onUpdateUser?: (body: unknown, url: string) => Response;
  onResetPassword?: (body: unknown, url: string) => Response;
}

function stubFetch(options: StubOptions = {}) {
  const users = options.users ?? [ADMIN_USER, DRIVER_USER];
  const routes = options.routes ?? [ACTIVE_ROUTE];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body as string) : undefined;

      if (url.includes('/reset-password') && method === 'POST') {
        return options.onResetPassword ? options.onResetPassword(body, url) : new Response(null, { status: 204 });
      }
      if (url.includes('/admin/users') && method === 'POST') {
        return options.onCreateUser ? options.onCreateUser(body) : jsonResponse(201, { ...DRIVER_USER, ...(body as object), id: 'new-user' });
      }
      if (url.includes('/admin/users') && method === 'PUT') {
        return options.onUpdateUser ? options.onUpdateUser(body, url) : jsonResponse(200, { ...DRIVER_USER, ...(body as object) });
      }
      if (url.includes('/admin/users')) {
        return jsonResponse(200, users);
      }
      if (url.includes('/admin/routes') && method === 'POST') {
        return jsonResponse(201, ACTIVE_ROUTE);
      }
      if (url.includes('/admin/routes')) {
        return jsonResponse(200, routes);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }),
  );
}

function callsMatching(predicate: (url: string, init: RequestInit | undefined) => boolean) {
  return vi.mocked(fetch).mock.calls.filter(([input, init]) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    return predicate(url, init as RequestInit | undefined);
  });
}

function lastBodyFor(predicate: (url: string, init: RequestInit | undefined) => boolean): unknown {
  const calls = callsMatching(predicate);
  const [, init] = calls[calls.length - 1];
  return JSON.parse((init as RequestInit).body as string);
}

function renderUsersPage(authValue: AuthContextValue = AUTH_VALUE) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/users']}>
          <UsersPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

async function openEditFor(name: string) {
  const row = (await screen.findByText(name)).closest('tr') as HTMLElement;
  await act(async () => {
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  });
}

/**
 * Scopes queries to the open modal. Necessary because several action labels
 * ("Create user", "Reset password") deliberately appear both in the page/row
 * and as the dialog's own confirm button — an index-based lookup would pick
 * the wrong one as soon as the table has more than one row.
 */
function dialog() {
  return within(screen.getByRole('dialog'));
}

describe('UsersPage', () => {
  beforeEach(() => {
    resetApiClientForTests();
    setAccessToken('test-access-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders ADMIN and DRIVER rows with role, status, and route', async () => {
    stubFetch();
    renderUsersPage();

    const driverRow = (await screen.findByText('Dana Driver')).closest('tr') as HTMLElement;
    expect(within(driverRow).getByText('Driver')).toBeInTheDocument();
    expect(within(driverRow).getByText('R1 — North Loop')).toBeInTheDocument();
    expect(within(driverRow).getByText('Active')).toBeInTheDocument();

    const adminRow = (await screen.findByText('Bob Admin')).closest('tr') as HTMLElement;
    expect(within(adminRow).getByText('Admin')).toBeInTheDocument();
    // An ADMIN never has a route — a neutral dash, not a blank cell.
    expect(within(adminRow).getByText('—')).toBeInTheDocument();
  });

  it('shows an inactive user as Inactive', async () => {
    stubFetch({ users: [{ ...DRIVER_USER, active: false }] });
    renderUsersPage();

    const row = (await screen.findByText('Dana Driver')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Inactive')).toBeInTheDocument();
  });

  it('offers no delete action anywhere', async () => {
    stubFetch();
    renderUsersPage();
    await screen.findByText('Dana Driver');

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('creating an ADMIN sends no routeId and hides the route field', async () => {
    stubFetch({ onCreateUser: (body) => jsonResponse(201, { ...ADMIN_USER, ...(body as object), id: 'new-admin' }) });
    renderUsersPage();
    await screen.findByText('Dana Driver');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'ADMIN' } });
    });

    expect(screen.queryByLabelText('Route')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Admin' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new.admin@warehouse.example' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'temp-password-1' } });

    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Create user' }));
    });

    await waitFor(() => expect(callsMatching((url, init) => url.includes('/admin/users') && init?.method === 'POST')).toHaveLength(1));
    const body = lastBodyFor((url, init) => url.includes('/admin/users') && init?.method === 'POST') as Record<string, unknown>;
    expect(body.role).toBe('ADMIN');
    expect(body).not.toHaveProperty('routeId');
    expect(body.password).toBe('temp-password-1');
  });

  it('creating a DRIVER requires a route and sends routeId plus the temporary password', async () => {
    stubFetch();
    renderUsersPage();
    await screen.findByText('Dana Driver');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Driver' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new.driver@warehouse.example' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'temp-password-1' } });

    // No route selected yet — blocked client-side, nothing sent.
    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Create user' }));
    });
    expect(await screen.findByText('An active driver requires a route.')).toBeInTheDocument();
    expect(callsMatching((url, init) => url.includes('/admin/users') && init?.method === 'POST')).toHaveLength(0);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Route'), { target: { value: ROUTE_ID } });
    });
    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Create user' }));
    });

    await waitFor(() => expect(callsMatching((url, init) => url.includes('/admin/users') && init?.method === 'POST')).toHaveLength(1));
    const body = lastBodyFor((url, init) => url.includes('/admin/users') && init?.method === 'POST') as Record<string, unknown>;
    expect(body.role).toBe('DRIVER');
    expect(body.routeId).toBe(ROUTE_ID);
    expect(body.password).toBe('temp-password-1');
  });

  it('a successful create closes the dialog, refreshes the list, and clears the password from the form', async () => {
    stubFetch();
    renderUsersPage();
    await screen.findByText('Dana Driver');
    const listCallsBefore = callsMatching((url, init) => url.includes('/admin/users') && (init?.method ?? 'GET') === 'GET').length;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Driver' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new.driver@warehouse.example' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'temp-password-1' } });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Route'), { target: { value: ROUTE_ID } });
    });
    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Create user' }));
    });

    await waitFor(() => expect(screen.queryByLabelText('Temporary password')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(callsMatching((url, init) => url.includes('/admin/users') && (init?.method ?? 'GET') === 'GET').length).toBeGreaterThan(listCallsBefore),
    );

    // Reopening starts from a blank form — the previous password never persisted.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    expect(screen.getByLabelText('Temporary password')).toHaveValue('');
  });

  it('surfaces a backend create failure without closing the dialog', async () => {
    stubFetch({
      onCreateUser: () =>
        jsonResponse(409, { title: 'Duplicate Email', detail: 'A user with this email already exists.', status: 409 }),
    });
    renderUsersPage();
    await screen.findByText('Dana Driver');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dupe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dana@warehouse.example' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'temp-password-1' } });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Route'), { target: { value: ROUTE_ID } });
    });
    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Create user' }));
    });

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument();
    // Still open, with the non-password values preserved for correction.
    expect(screen.getByLabelText('Name')).toHaveValue('Dupe');
  });

  it('rejects a malformed email in the product\'s own wording before reaching the backend', async () => {
    stubFetch();
    renderUsersPage();
    await screen.findByText('Dana Driver');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Driver' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'temp-password-1' } });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Route'), { target: { value: ROUTE_ID } });
    });
    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Create user' }));
    });

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(callsMatching((url, init) => url.includes('/admin/users') && init?.method === 'POST')).toHaveLength(0);
  });

  it('Edit populates the authoritative values from the user record', async () => {
    stubFetch();
    renderUsersPage();
    await openEditFor('Dana Driver');

    expect(screen.getByLabelText('Name')).toHaveValue('Dana Driver');
    expect(screen.getByLabelText('Email')).toHaveValue('dana@warehouse.example');
    expect(screen.getByLabelText('Role')).toHaveValue('DRIVER');
    expect(screen.getByLabelText('Route')).toHaveValue(ROUTE_ID);
    expect(screen.getByLabelText('Active')).toBeChecked();
  });

  it('changing DRIVER to ADMIN clears the route and sends routeId null on save', async () => {
    stubFetch();
    renderUsersPage();
    await openEditFor('Dana Driver');

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'ADMIN' } });
    });
    expect(screen.queryByLabelText('Route')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1));
    const body = lastBodyFor((_url, init) => init?.method === 'PUT') as Record<string, unknown>;
    expect(body.role).toBe('ADMIN');
    expect(body.routeId).toBeNull();
  });

  it('changing ADMIN to DRIVER requires a route before saving', async () => {
    stubFetch();
    renderUsersPage();
    await openEditFor('Bob Admin');

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'DRIVER' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    expect(await screen.findByText('An active driver requires a route.')).toBeInTheDocument();
    expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(0);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Route'), { target: { value: ROUTE_ID } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1));
    expect((lastBodyFor((_url, init) => init?.method === 'PUT') as Record<string, unknown>).routeId).toBe(ROUTE_ID);
  });

  it('an update sends the complete PUT payload, never a partial patch', async () => {
    stubFetch();
    renderUsersPage();
    await openEditFor('Dana Driver');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dana Renamed' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1));
    const body = lastBodyFor((_url, init) => init?.method === 'PUT') as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['active', 'email', 'name', 'role', 'routeId']);
    expect(body.name).toBe('Dana Renamed');
    expect(body.active).toBe(true);
  });

  it('deactivating an active user requires explicit confirmation before the request is sent', async () => {
    stubFetch();
    renderUsersPage();
    await openEditFor('Dana Driver');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Active'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    // Confirmation shown; nothing sent yet.
    expect(await screen.findByText('Deactivate Dana Driver?')).toBeInTheDocument();
    expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate user' }));
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1));
    expect((lastBodyFor((_url, init) => init?.method === 'PUT') as Record<string, unknown>).active).toBe(false);
  });

  it('an ordinary edit saves without a deactivation confirmation', async () => {
    stubFetch();
    renderUsersPage();
    await openEditFor('Dana Driver');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dana Renamed' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1));
    expect(screen.queryByText(/Deactivate Dana Driver\?/)).not.toBeInTheDocument();
  });

  it('does not offer the authenticated ADMIN a way to change their own role or deactivate themselves', async () => {
    stubFetch({ users: [{ ...ADMIN_USER, id: ME_ID, name: 'Ada Admin', email: 'ada@warehouse.example' }] });
    renderUsersPage();
    await openEditFor('Ada Admin');

    expect(screen.getByLabelText('Role')).toBeDisabled();
    expect(screen.getByLabelText('Active')).toBeDisabled();
    expect(screen.getByText('You cannot change your own role or deactivate your own account.')).toBeInTheDocument();
  });

  it('shows the backend self-protection error safely if it is ever returned', async () => {
    stubFetch({
      users: [DRIVER_USER],
      onUpdateUser: () =>
        jsonResponse(400, { title: 'Self-Deactivation Not Allowed', detail: 'You cannot deactivate your own account.', status: 400 }),
    });
    renderUsersPage();
    await openEditFor('Dana Driver');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dana Renamed' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    expect(await screen.findByText('You cannot deactivate your own account.')).toBeInTheDocument();
  });

  it('keeps a DRIVER\'s now-inactive assigned route visible instead of silently replacing it', async () => {
    stubFetch({
      users: [{ ...DRIVER_USER, route: { id: INACTIVE_ROUTE_ID, code: 'R9', name: 'Retired Loop', active: false } }],
      routes: [ACTIVE_ROUTE, INACTIVE_ROUTE],
    });
    renderUsersPage();
    await openEditFor('Dana Driver');

    expect(screen.getByLabelText('Route')).toHaveValue(INACTIVE_ROUTE_ID);
    expect(screen.getByRole('option', { name: 'R9 — Retired Loop (inactive)' })).toBeInTheDocument();
  });

  it('does not offer an unrelated inactive route when assigning a driver', async () => {
    stubFetch({ routes: [ACTIVE_ROUTE, INACTIVE_ROUTE] });
    renderUsersPage();
    await openEditFor('Dana Driver');

    expect(screen.getByRole('option', { name: 'R1 — North Loop' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Retired Loop/ })).not.toBeInTheDocument();
  });

  it('reset password rejects a mismatched confirmation before sending anything', async () => {
    stubFetch();
    renderUsersPage();
    const row = (await screen.findByText('Dana Driver')).closest('tr') as HTMLElement;
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Reset password' }));
    });

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different-password' } });
    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Reset password' }));
    });

    expect(await screen.findByText('The two passwords do not match.')).toBeInTheDocument();
    expect(callsMatching((url) => url.includes('/reset-password'))).toHaveLength(0);
  });

  it('reset password rejects a password shorter than the backend minimum before sending anything', async () => {
    stubFetch();
    renderUsersPage();
    const row = (await screen.findByText('Dana Driver')).closest('tr') as HTMLElement;
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Reset password' }));
    });

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'short' } });
    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Reset password' }));
    });

    expect(await screen.findByText('New password must be at least 8 characters.')).toBeInTheDocument();
    expect(callsMatching((url) => url.includes('/reset-password'))).toHaveLength(0);
  });

  it('reset password sends only newPassword, then clears the sensitive state and never echoes it back', async () => {
    stubFetch();
    renderUsersPage();
    const row = (await screen.findByText('Dana Driver')).closest('tr') as HTMLElement;
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Reset password' }));
    });

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-1' } });
    await act(async () => {
      fireEvent.click(dialog().getByRole('button', { name: 'Reset password' }));
    });

    await waitFor(() => expect(callsMatching((url) => url.includes('/reset-password'))).toHaveLength(1));
    const body = lastBodyFor((url) => url.includes('/reset-password')) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['newPassword']);
    expect(body.newPassword).toBe('new-password-1');

    // Dialog closed, fields gone, and the password itself is never rendered.
    await waitFor(() => expect(screen.queryByLabelText('New password')).not.toBeInTheDocument());
    expect(screen.queryByText(/new-password-1/)).not.toBeInTheDocument();
    expect(screen.getByText('Password reset for "Dana Driver".')).toBeInTheDocument();
  });

  it('filters the table by name or email', async () => {
    stubFetch();
    renderUsersPage();
    await screen.findByText('Dana Driver');

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'bob@' } });

    expect(screen.getByText('Bob Admin')).toBeInTheDocument();
    expect(screen.queryByText('Dana Driver')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the user list fails to load', async () => {
    stubFetch({ users: [] });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/admin/routes')) {
          return jsonResponse(200, [ACTIVE_ROUTE]);
        }
        return jsonResponse(500, {});
      }),
    );
    renderUsersPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
