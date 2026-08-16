import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '../api/apiClient';
import { RoutesPage } from './RoutesPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ROUTE_ID = '22222222-2222-2222-2222-222222222222';
const INACTIVE_ROUTE_ID = '33333333-3333-3333-3333-333333333333';

const ACTIVE_ROUTE = { id: ROUTE_ID, code: 'R1', name: 'North Loop', active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const INACTIVE_ROUTE = { id: INACTIVE_ROUTE_ID, code: 'R9', name: 'Retired Loop', active: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };

interface StubOptions {
  routes?: unknown[];
  onCreateRoute?: (body: unknown) => Response;
  onUpdateRoute?: (body: unknown) => Response;
}

function stubFetch(options: StubOptions = {}) {
  const routes = options.routes ?? [ACTIVE_ROUTE, INACTIVE_ROUTE];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body as string) : undefined;

      if (url.includes('/admin/routes') && method === 'POST') {
        return options.onCreateRoute ? options.onCreateRoute(body) : jsonResponse(201, { ...ACTIVE_ROUTE, ...(body as object), id: 'new-route' });
      }
      if (url.includes('/admin/routes') && method === 'PUT') {
        return options.onUpdateRoute ? options.onUpdateRoute(body) : jsonResponse(200, { ...ACTIVE_ROUTE, ...(body as object) });
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

function renderRoutesPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/routes']}>
        <RoutesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openEditFor(code: string) {
  const row = (await screen.findByText(code)).closest('tr') as HTMLElement;
  await act(async () => {
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  });
}

describe('RoutesPage', () => {
  beforeEach(() => {
    resetApiClientForTests();
    setAccessToken('test-access-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders active and inactive routes with code, name, and status', async () => {
    stubFetch();
    renderRoutesPage();

    const activeRow = (await screen.findByText('R1')).closest('tr') as HTMLElement;
    expect(within(activeRow).getByText('North Loop')).toBeInTheDocument();
    expect(within(activeRow).getByText('Active')).toBeInTheDocument();

    const inactiveRow = (await screen.findByText('R9')).closest('tr') as HTMLElement;
    expect(within(inactiveRow).getByText('Inactive')).toBeInTheDocument();
  });

  it('offers no delete action anywhere', async () => {
    stubFetch();
    renderRoutesPage();
    await screen.findByText('R1');

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('creating a route sends the code and name, and refreshes the list', async () => {
    stubFetch();
    renderRoutesPage();
    await screen.findByText('R1');
    const listCallsBefore = callsMatching((url, init) => url.includes('/admin/routes') && (init?.method ?? 'GET') === 'GET').length;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create route' }));
    });
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'R2' } });
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'South Loop' } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Create route' })[1]);
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'POST')).toHaveLength(1));
    expect(lastBodyFor((_url, init) => init?.method === 'POST')).toEqual({ code: 'R2', name: 'South Loop' });

    await waitFor(() =>
      expect(callsMatching((url, init) => url.includes('/admin/routes') && (init?.method ?? 'GET') === 'GET').length).toBeGreaterThan(listCallsBefore),
    );
  });

  it('creating a route without a name sends null rather than an empty string', async () => {
    stubFetch();
    renderRoutesPage();
    await screen.findByText('R1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create route' }));
    });
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'R3' } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Create route' })[1]);
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'POST')).toHaveLength(1));
    expect(lastBodyFor((_url, init) => init?.method === 'POST')).toEqual({ code: 'R3', name: null });
  });

  it('requires a code before sending a create request', async () => {
    stubFetch();
    renderRoutesPage();
    await screen.findByText('R1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create route' }));
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Create route' })[1]);
    });

    expect(await screen.findByText('Code is required.')).toBeInTheDocument();
    expect(callsMatching((_url, init) => init?.method === 'POST')).toHaveLength(0);
  });

  it('surfaces a duplicate-code conflict without closing the dialog', async () => {
    stubFetch({
      onCreateRoute: () => jsonResponse(409, { title: 'Duplicate Route Code', detail: 'A route with this code already exists.', status: 409 }),
    });
    renderRoutesPage();
    await screen.findByText('R1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create route' }));
    });
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'R1' } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Create route' })[1]);
    });

    expect(await screen.findByText('A route with this code already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveValue('R1');
  });

  it('Edit populates the authoritative values', async () => {
    stubFetch();
    renderRoutesPage();
    await openEditFor('R1');

    expect(screen.getByLabelText('Code')).toHaveValue('R1');
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('North Loop');
    expect(screen.getByLabelText('Active')).toBeChecked();
  });

  it('an update sends the complete PUT payload, never a partial patch', async () => {
    stubFetch();
    renderRoutesPage();
    await openEditFor('R1');

    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Renamed Loop' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1));
    const body = lastBodyFor((_url, init) => init?.method === 'PUT') as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['active', 'code', 'name']);
    expect(body).toEqual({ code: 'R1', name: 'Renamed Loop', active: true });
  });

  it('reactivating an inactive route saves without a destructive confirmation', async () => {
    stubFetch();
    renderRoutesPage();
    await openEditFor('R9');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Active'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1));
    expect((lastBodyFor((_url, init) => init?.method === 'PUT') as Record<string, unknown>).active).toBe(true);
  });

  it('deactivating an active route requires explicit confirmation before the request is sent', async () => {
    stubFetch();
    renderRoutesPage();
    await openEditFor('R1');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Active'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });

    expect(await screen.findByText('Deactivate route R1?')).toBeInTheDocument();
    expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate route' }));
    });

    await waitFor(() => expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1));
    expect((lastBodyFor((_url, init) => init?.method === 'PUT') as Record<string, unknown>).active).toBe(false);
  });

  it('keeps a blocked deactivation visible and preserves the form instead of faking success', async () => {
    stubFetch({
      onUpdateRoute: () =>
        jsonResponse(409, {
          title: 'Route In Use',
          detail: 'This route is assigned to at least one active driver and cannot be deactivated.',
          status: 409,
        }),
    });
    renderRoutesPage();
    await openEditFor('R1');

    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Edited Name' } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Active'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate route' }));
    });

    expect(
      await screen.findByText('This route is assigned to at least one active driver and cannot be deactivated.'),
    ).toBeInTheDocument();
    // Back in the edit form with the ADMIN's own values intact — the route is
    // still shown as Active in the list, and no user was silently reassigned.
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('Edited Name');
    expect(callsMatching((_url, init) => init?.method === 'PUT')).toHaveLength(1);
  });

  it('shows the empty state when no routes exist yet', async () => {
    stubFetch({ routes: [] });
    renderRoutesPage();

    expect(await screen.findByText('No routes have been created yet.')).toBeInTheDocument();
  });

  it('shows a retryable error when the route list fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, {})));
    renderRoutesPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
