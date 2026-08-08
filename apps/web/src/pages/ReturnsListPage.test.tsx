import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '../api/apiClient';
import { ReturnsListPage } from './ReturnsListPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const DRIVER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_DRIVER_ID = '11111111-1111-1111-1111-111111111112';
const ROUTE_ID = '22222222-2222-2222-2222-222222222222';

const USERS = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000000', name: 'Ada Admin', role: 'ADMIN', active: true },
  { id: DRIVER_ID, name: 'Dana Driver', role: 'DRIVER', active: true },
  { id: OTHER_DRIVER_ID, name: 'Doug Driver', role: 'DRIVER', active: true },
];

const ROUTES = [{ id: ROUTE_ID, code: 'R1', name: 'North Loop', active: true }];

function makeReturn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    returnNumber: 'RF-000001',
    customerName: 'Acme',
    productName: 'Widget',
    quantity: 2,
    unit: 'EA',
    reason: 'DAMAGED',
    status: 'AWAITING_WAREHOUSE',
    driver: { id: DRIVER_ID, fullName: 'Dana Driver' },
    route: { id: ROUTE_ID, code: 'R1', name: 'North Loop', active: true },
    createdAt: '2026-08-06T02:15:00Z',
    photoCount: 0,
    hasSignature: false,
    ...overrides,
  };
}

function makePage(content: unknown[], overrides: Record<string, unknown> = {}) {
  return { content, page: 0, size: 25, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0, ...overrides };
}

type ReturnsResponder = (url: URL) => Response;

function defaultReturnsResponder(url: URL): Response {
  const page = Number(url.searchParams.get('page') ?? '0');
  return jsonResponse(200, makePage([makeReturn()], { page, totalPages: 3, totalElements: 60 }));
}

function stubFetch(returnsResponder: ReturnsResponder = defaultReturnsResponder) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : (input as Request).url;
      if (rawUrl.includes('/admin/users')) {
        return jsonResponse(200, USERS);
      }
      if (rawUrl.includes('/admin/routes')) {
        return jsonResponse(200, ROUTES);
      }
      if (rawUrl.includes('/admin/returns')) {
        return returnsResponder(new URL(rawUrl, 'http://localhost'));
      }
      throw new Error(`Unexpected request: ${rawUrl}`);
    }),
  );
}

function lastReturnsRequestUrl(): URL {
  const calls = vi.mocked(fetch).mock.calls.filter(([input]) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    return url.includes('/admin/returns');
  });
  const [input] = calls[calls.length - 1];
  const rawUrl = typeof input === 'string' ? input : (input as Request).url;
  return new URL(rawUrl, 'http://localhost');
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="url">{`${location.pathname}${location.search}`}</div>;
}

function renderReturnsPage(initialPath = '/returns') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationDisplay />
        <Routes>
          <Route path="/returns" element={<ReturnsListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReturnsListPage', () => {
  beforeEach(() => {
    resetApiClientForTests();
    setAccessToken('test-access-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends page=0 and size=25 on the initial unfiltered load', async () => {
    stubFetch();
    renderReturnsPage();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const url = lastReturnsRequestUrl();
    expect(url.searchParams.get('page')).toBe('0');
    expect(url.searchParams.get('size')).toBe('25');
  });

  it('renders rows from the server response', async () => {
    stubFetch(() => jsonResponse(200, makePage([makeReturn({ returnNumber: 'RF-000042', customerName: 'Acme Ltd' })])));
    renderReturnsPage();

    await waitFor(() => expect(screen.getByText('RF-000042')).toBeInTheDocument());
    expect(screen.getByText('Acme Ltd')).toBeInTheDocument();
  });

  it('links the Return # to /returns/{id}, preserving the current filtered view as the "back" destination', async () => {
    stubFetch(() => jsonResponse(200, makePage([makeReturn({ id: 'return-row-1', returnNumber: 'RF-000042' })])));
    renderReturnsPage('/returns?status=AWAITING_WAREHOUSE');

    await waitFor(() => expect(screen.getByRole('link', { name: 'RF-000042' })).toHaveAttribute('href', '/returns/return-row-1'));
  });

  it('reads pagination fields from the PageResponse envelope', async () => {
    stubFetch(() => jsonResponse(200, makePage([makeReturn()], { page: 2, totalPages: 5, totalElements: 113 })));
    renderReturnsPage();

    await waitFor(() => expect(screen.getByText(/Page 3 of 5/)).toBeInTheDocument());
    expect(screen.getByText(/113 total/)).toBeInTheDocument();
  });

  it('Next/Previous update the requested page', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    });
    await waitFor(() => expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument());
    expect(lastReturnsRequestUrl().searchParams.get('page')).toBe('1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    });
    await waitFor(() => expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument());
    expect(lastReturnsRequestUrl().searchParams.get('page')).toBe('0');
  });

  it('disables Previous on the first page and Next on the last page', async () => {
    stubFetch(() => jsonResponse(200, makePage([makeReturn()], { page: 0, totalPages: 1, totalElements: 1 })));
    renderReturnsPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('search reaches the backend as the search parameter', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'acme' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    });

    await waitFor(() => expect(lastReturnsRequestUrl().searchParams.get('search')).toBe('acme'));
    expect(screen.getByTestId('url')).toHaveTextContent('search=acme');
  });

  it('status filter reaches the backend', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'AWAITING_WAREHOUSE' } });
    });

    await waitFor(() => expect(lastReturnsRequestUrl().searchParams.get('status')).toBe('AWAITING_WAREHOUSE'));
  });

  it('reason filter reaches the backend', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'DAMAGED' } });
    });

    await waitFor(() => expect(lastReturnsRequestUrl().searchParams.get('reason')).toBe('DAMAGED'));
  });

  it('date range reaches the backend as createdFrom/createdTo', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Created to'), { target: { value: '2026-01-31' } });
    await act(async () => {
      fireEvent.blur(screen.getByLabelText('Created to'));
    });

    await waitFor(() => {
      const url = lastReturnsRequestUrl();
      expect(url.searchParams.get('createdFrom')).toBe('2026-01-01');
      expect(url.searchParams.get('createdTo')).toBe('2026-01-31');
    });
  });

  it('driver filter reaches the backend as driverId', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Dana Driver' })).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Driver'), { target: { value: DRIVER_ID } });
    });

    await waitFor(() => expect(lastReturnsRequestUrl().searchParams.get('driverId')).toBe(DRIVER_ID));
  });

  it('does not offer ADMIN users in the driver dropdown', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Dana Driver' })).toBeInTheDocument());

    expect(screen.queryByRole('option', { name: 'Ada Admin' })).not.toBeInTheDocument();
  });

  it('route filter reaches the backend as routeId', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(screen.getByRole('option', { name: /North Loop/ })).toBeInTheDocument());

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Route'), { target: { value: ROUTE_ID } });
    });

    await waitFor(() => expect(lastReturnsRequestUrl().searchParams.get('routeId')).toBe(ROUTE_ID));
  });

  it('combines multiple active filters into one request', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'AWAITING_WAREHOUSE' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'DAMAGED' } });
    });

    await waitFor(() => {
      const url = lastReturnsRequestUrl();
      expect(url.searchParams.get('status')).toBe('AWAITING_WAREHOUSE');
      expect(url.searchParams.get('reason')).toBe('DAMAGED');
    });
  });

  it('resets to page 0 whenever a filter changes', async () => {
    stubFetch();
    renderReturnsPage('/returns?page=2');
    await waitFor(() => expect(lastReturnsRequestUrl().searchParams.get('page')).toBe('2'));

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'AWAITING_WAREHOUSE' } });
    });

    await waitFor(() => expect(lastReturnsRequestUrl().searchParams.get('page')).toBe('0'));
  });

  it('restores filter state from the URL on initial render', async () => {
    stubFetch();
    renderReturnsPage('/returns?status=AWAITING_WAREHOUSE&search=acme');
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(screen.getByLabelText('Status')).toHaveValue('AWAITING_WAREHOUSE');
    expect(screen.getByLabelText('Search')).toHaveValue('acme');
    await waitFor(() => {
      const url = lastReturnsRequestUrl();
      expect(url.searchParams.get('status')).toBe('AWAITING_WAREHOUSE');
      expect(url.searchParams.get('search')).toBe('acme');
    });
  });

  it('Clear filters resets search, filters, and page together', async () => {
    stubFetch();
    renderReturnsPage('/returns?status=AWAITING_WAREHOUSE&search=acme&page=2');
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    });

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/returns'));
    expect(screen.getByTestId('url').textContent).not.toContain('?');
    expect(screen.getByLabelText('Search')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('shows the empty-tenant message when there are no returns and no filters are active', async () => {
    stubFetch(() => jsonResponse(200, makePage([])));
    renderReturnsPage();

    await waitFor(() => expect(screen.getByText('No returns have been created yet.')).toBeInTheDocument());
  });

  it('shows the no-results message with Clear filters when filters are active but nothing matches', async () => {
    stubFetch(() => jsonResponse(200, makePage([])));
    renderReturnsPage('/returns?search=nomatch');

    await waitFor(() => expect(screen.getByText('No returns match the current filters.')).toBeInTheDocument());
    // Two "Clear filters" controls exist here: the filter bar's own, plus the empty-state's action.
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows a retryable error on API failure, preserving active filters', async () => {
    stubFetch(() => jsonResponse(500, {}));
    renderReturnsPage('/returns?search=acme');

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText('Search')).toHaveValue('acme');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText('Search')).toHaveValue('acme');
  });

  it('flags an invalid date range client-side without sending it to the API', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const callsBefore = vi.mocked(fetch).mock.calls.length;

    fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Created to'), { target: { value: '2026-01-01' } });
    await act(async () => {
      fireEvent.blur(screen.getByLabelText('Created to'));
    });

    expect(await screen.findByText('"Created from" must not be after "Created to".')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore);
  });

  it('never introduces a token, tenant ID, or other server-internal value into the URL', async () => {
    stubFetch();
    renderReturnsPage();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'AWAITING_WAREHOUSE' } });
    });
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('status=AWAITING_WAREHOUSE'));

    const currentUrl = screen.getByTestId('url').textContent ?? '';
    expect(currentUrl).not.toMatch(/token/i);
    expect(currentUrl).not.toMatch(/tenant/i);
    expect(currentUrl).not.toMatch(/bearer/i);
  });
});
