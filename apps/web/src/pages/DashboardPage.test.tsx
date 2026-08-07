import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '../api/apiClient';
import { DashboardPage } from './DashboardPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function ReturnsLocationSpy() {
  const location = useLocation();
  return <div data-testid="returns-location">{`${location.pathname}${location.search}`}</div>;
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/returns" element={<ReturnsLocationSpy />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SUMMARY = { waitingWarehouse: 4, inReview: 0, closedToday: 0, returnsToday: 7 };

const LATEST_RETURNS_PAGE = {
  content: [
    {
      id: 'r1',
      returnNumber: 'RF-000001',
      customerName: 'Acme',
      productName: 'Widget',
      quantity: 2,
      unit: 'EA',
      reason: 'DAMAGED',
      status: 'AWAITING_WAREHOUSE',
      driver: { id: 'd1', fullName: 'Dana Driver' },
      route: { id: 'rt1', code: 'R1', name: 'Route 1', active: true },
      createdAt: '2026-08-06T02:15:00Z',
      photoCount: 1,
      hasSignature: true,
    },
  ],
  page: 0,
  size: 5,
  totalElements: 1,
  totalPages: 1,
};

const EMPTY_PAGE = { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 };

interface FetchOverrides {
  summary?: Response | (() => Promise<Response>);
  latest?: Response | (() => Promise<Response>);
}

function stubFetch(overrides: FetchOverrides = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/admin/dashboard/summary')) {
        return overrides.summary instanceof Function ? overrides.summary() : (overrides.summary ?? jsonResponse(200, SUMMARY));
      }
      if (url.includes('/admin/returns')) {
        return overrides.latest instanceof Function ? overrides.latest() : (overrides.latest ?? jsonResponse(200, LATEST_RETURNS_PAGE));
      }
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    resetApiClientForTests();
    setAccessToken('test-access-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows a loading indicator before the summary resolves', async () => {
    let resolveSummary!: (response: Response) => void;
    stubFetch({
      summary: () =>
        new Promise((resolve) => {
          resolveSummary = resolve;
        }),
    });

    renderDashboard();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);

    resolveSummary(jsonResponse(200, SUMMARY));
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
  });

  it('displays the real Waiting Warehouse and Returns Today counts', async () => {
    stubFetch();
    renderDashboard();

    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('marks In Review and Closed Today as visibly not yet operational', async () => {
    stubFetch();
    renderDashboard();

    await waitFor(() => expect(screen.getAllByText('Available with warehouse review')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: /In Review/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Closed Today/ })).not.toBeInTheDocument();
  });

  it('navigates Waiting Warehouse to the correct Returns filter', async () => {
    stubFetch();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());

    await act(async () => {
      screen.getByRole('button', { name: /Waiting Warehouse/ }).click();
    });

    await waitFor(() => expect(screen.getByTestId('returns-location')).toHaveTextContent('/returns?status=AWAITING_WAREHOUSE'));
  });

  it('navigates Returns Today using an explicit Australia/Sydney date, not the browser-local date', async () => {
    // Only `Date` is faked — `setTimeout` stays real, so Testing Library's
    // `waitFor` (which polls via a real timer) keeps working normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    // 2026-01-01T23:30:00Z is already 2026-01-02 in Sydney (UTC+11 in January).
    vi.setSystemTime(new Date('2026-01-01T23:30:00Z'));
    stubFetch();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());

    await act(async () => {
      screen.getByRole('button', { name: /Returns Today/ }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('returns-location')).toHaveTextContent('/returns?createdFrom=2026-01-02&createdTo=2026-01-02'),
    );
  });

  it('shows a retryable error when the summary request fails, without hiding Latest Returns', async () => {
    stubFetch({ summary: jsonResponse(500, {}) });
    renderDashboard();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('RF-000001')).toBeInTheDocument());
  });

  it('renders Latest Returns rows on success', async () => {
    stubFetch();
    renderDashboard();

    await waitFor(() => expect(screen.getByText('RF-000001')).toBeInTheDocument());
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('shows an empty message when no returns exist yet', async () => {
    stubFetch({ latest: jsonResponse(200, EMPTY_PAGE) });
    renderDashboard();

    await waitFor(() => expect(screen.getByText('No returns have been created yet.')).toBeInTheDocument());
  });

  it('a Latest Returns failure does not remove the summary cards', async () => {
    stubFetch({ latest: jsonResponse(500, {}) });
    renderDashboard();

    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('manual refresh re-invokes both queries', async () => {
    stubFetch();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('RF-000001')).toBeInTheDocument());

    const callsBefore = vi.mocked(fetch).mock.calls.length;
    await act(async () => {
      screen.getByRole('button', { name: 'Refresh' }).click();
    });

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
