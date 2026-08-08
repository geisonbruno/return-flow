import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '../api/apiClient';
import { ReturnDetailsPage } from './ReturnDetailsPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const RETURN_ID = '11111111-1111-1111-1111-111111111111';

const DETAIL = {
  id: RETURN_ID,
  returnNumber: 'RF-000042',
  status: 'AWAITING_WAREHOUSE',
  customerName: 'Acme Pty Ltd',
  productName: 'Widget',
  quantity: 3,
  unit: 'CTN',
  reason: 'DAMAGED',
  reasonDetails: null,
  observation: 'Box was crushed.',
  driver: { id: 'd1', fullName: 'Dana Driver' },
  route: { id: 'rt1', code: 'R1', name: 'North Loop', active: true },
  photos: [] as unknown[],
  signature: null as unknown,
  createdAt: '2026-08-06T02:15:00Z',
  updatedAt: '2026-08-06T02:15:00Z',
};

function renderReturnDetails(path: string = `/returns/${RETURN_ID}`) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/returns/:returnId" element={<ReturnDetailsPage />} />
          <Route path="/returns" element={<div>Returns Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Handles the detail request plus any photo/signature content request generically — override with a custom fetch mock for failure-injection tests. */
function stubFetch(detailResponder: (url: URL) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : (input as Request).url;
      const url = new URL(rawUrl, 'http://localhost');
      if (url.pathname.includes('/photos/') || url.pathname.includes('/signature/content')) {
        return new Response(new Blob(['fake-bytes'], { type: 'image/jpeg' }), { status: 200 });
      }
      return detailResponder(url);
    }),
  );
}

describe('ReturnDetailsPage', () => {
  beforeEach(() => {
    resetApiClientForTests();
    setAccessToken('test-access-token');
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state before the detail resolves', async () => {
    let resolveDetail!: (response: Response) => void;
    stubFetch(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        }),
    );

    renderReturnDetails();
    expect(screen.getByText('Loading return details…')).toBeInTheDocument();

    resolveDetail(jsonResponse(200, DETAIL));
    await waitFor(() => expect(screen.getByText('RF-000042')).toBeInTheDocument());
  });

  it('renders complete return information on success', async () => {
    stubFetch(() => jsonResponse(200, DETAIL));
    renderReturnDetails();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'RF-000042' })).toBeInTheDocument());
    expect(screen.getByText('Awaiting warehouse')).toBeInTheDocument();
    expect(screen.getByText('Acme Pty Ltd')).toBeInTheDocument();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('3 CTN')).toBeInTheDocument();
    expect(screen.getByText('Damaged')).toBeInTheDocument();
    expect(screen.getByText('Box was crushed.')).toBeInTheDocument();
    expect(screen.getByText('Dana Driver')).toBeInTheDocument();
    expect(screen.getByText('R1 — North Loop')).toBeInTheDocument();
    expect(screen.getByText(/6 Aug 2026/)).toBeInTheDocument();
  });

  it('sets the document title to the return number after loading, and a generic title while loading', async () => {
    let resolveDetail!: (response: Response) => void;
    stubFetch(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        }),
    );

    renderReturnDetails();
    expect(document.title).toBe('ReturnFlow — Return Details');

    resolveDetail(jsonResponse(200, DETAIL));
    await waitFor(() => expect(document.title).toBe('ReturnFlow — RF-000042'));
  });

  it('shows reasonDetails only when present', async () => {
    stubFetch(() => jsonResponse(200, { ...DETAIL, reasonDetails: 'Something unusual happened.' }));
    renderReturnDetails();
    await waitFor(() => expect(screen.getByText('Something unusual happened.')).toBeInTheDocument());
  });

  it('omits the reason-details row entirely when reasonDetails is absent', async () => {
    stubFetch(() => jsonResponse(200, DETAIL));
    renderReturnDetails();
    await waitFor(() => expect(screen.getByText('RF-000042')).toBeInTheDocument());
    expect(screen.queryByText('Reason details')).not.toBeInTheDocument();
  });

  it('shows a neutral fallback when observation is empty', async () => {
    stubFetch(() => jsonResponse(200, { ...DETAIL, observation: null }));
    renderReturnDetails();
    await waitFor(() => expect(screen.getByText('No observation.')).toBeInTheDocument());
  });

  it('shows "This return could not be found." for a 404, never the raw backend detail text', async () => {
    stubFetch(() => jsonResponse(404, { title: 'Return Not Found', detail: 'Return not found.' }));
    renderReturnDetails();

    await waitFor(() => expect(screen.getByText('This return could not be found.')).toBeInTheDocument());
    expect(screen.queryByText('Return not found.')).not.toBeInTheDocument();
  });

  it('shows the same not-found experience for a malformed return ID, without ever calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderReturnDetails('/returns/not-a-uuid');

    expect(screen.getByText('This return could not be found.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a retryable error for a generic API failure, without leaking a raw non-ProblemDetail response body', async () => {
    // A malformed/non-JSON 500 (e.g. a raw gateway error page) is the
    // realistic "something leaked" case — a genuine backend ProblemDetail
    // `detail` is already safe-by-contract (GlobalExceptionHandler never
    // includes stack traces or internals in it), so the frontend's job here
    // is to fall back safely when there is no well-formed detail at all.
    stubFetch(() => new Response('<html>Internal Server Error</html>', { status: 500, headers: { 'Content-Type': 'text/html' } }));
    renderReturnDetails();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/<html>/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Internal Server Error/)).not.toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'Retry' }).click();
    });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows "No photos yet." when there are no photos', async () => {
    stubFetch(() => jsonResponse(200, DETAIL));
    renderReturnDetails();
    await waitFor(() => expect(screen.getByText('No photos yet.')).toBeInTheDocument());
  });

  it('renders multiple photos in position order', async () => {
    stubFetch(() =>
      jsonResponse(200, {
        ...DETAIL,
        photos: [
          {
            id: 'ph2',
            contentType: 'image/jpeg',
            sizeBytes: 100,
            position: 2,
            contentPath: `/api/v1/admin/returns/${RETURN_ID}/photos/ph2/content`,
            createdAt: DETAIL.createdAt,
          },
          {
            id: 'ph1',
            contentType: 'image/jpeg',
            sizeBytes: 100,
            position: 1,
            contentPath: `/api/v1/admin/returns/${RETURN_ID}/photos/ph1/content`,
            createdAt: DETAIL.createdAt,
          },
        ],
      }),
    );
    renderReturnDetails();

    await waitFor(() => expect(screen.getAllByRole('img', { name: /Return photo/ })).toHaveLength(2));
    const images = screen.getAllByRole('img', { name: /Return photo/ });
    expect(images[0]).toHaveAttribute('alt', 'Return photo 1');
    expect(images[1]).toHaveAttribute('alt', 'Return photo 2');
  });

  it('one failed photo does not hide the others or the rest of the page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const rawUrl = typeof input === 'string' ? input : (input as Request).url;
        if (rawUrl.includes('ph-fail')) {
          return jsonResponse(500, {});
        }
        if (rawUrl.includes('ph-ok')) {
          return new Response(new Blob(['bytes'], { type: 'image/jpeg' }), { status: 200 });
        }
        return jsonResponse(200, {
          ...DETAIL,
          photos: [
            {
              id: 'ph-fail',
              contentType: 'image/jpeg',
              sizeBytes: 100,
              position: 1,
              contentPath: `/api/v1/admin/returns/${RETURN_ID}/photos/ph-fail/content`,
              createdAt: DETAIL.createdAt,
            },
            {
              id: 'ph-ok',
              contentType: 'image/jpeg',
              sizeBytes: 100,
              position: 2,
              contentPath: `/api/v1/admin/returns/${RETURN_ID}/photos/ph-ok/content`,
              createdAt: DETAIL.createdAt,
            },
          ],
        });
      }),
    );

    renderReturnDetails();

    await waitFor(() => expect(screen.getByRole('img', { name: 'Return photo 2' })).toBeInTheDocument());
    expect(screen.getByText('Acme Pty Ltd')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('resolves a photo contentPath to a single, non-duplicated /api/v1 request', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : (input as Request).url;
      if (rawUrl.includes('/photos/')) {
        return new Response(new Blob(['bytes']), { status: 200 });
      }
      return jsonResponse(200, {
        ...DETAIL,
        photos: [
          {
            id: 'ph1',
            contentType: 'image/jpeg',
            sizeBytes: 100,
            position: 1,
            contentPath: `/api/v1/admin/returns/${RETURN_ID}/photos/ph1/content`,
            createdAt: DETAIL.createdAt,
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderReturnDetails();
    await waitFor(() => expect(screen.getByRole('img', { name: 'Return photo 1' })).toBeInTheDocument());

    const photoCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      return url.includes('/photos/');
    });
    const calledUrl = typeof photoCall![0] === 'string' ? photoCall![0] : (photoCall![0] as Request).url;
    expect(calledUrl).not.toContain('/api/v1/api/v1');
    expect(calledUrl).toContain('/api/v1/admin/returns');
  });

  it('shows "Signature pending." when there is no signature', async () => {
    stubFetch(() => jsonResponse(200, DETAIL));
    renderReturnDetails();
    await waitFor(() => expect(screen.getByText('Signature pending.')).toBeInTheDocument());
  });

  it('renders signerName and a Sydney-formatted signedAt, with the signature rendered as a real <img>', async () => {
    stubFetch(() =>
      jsonResponse(200, {
        ...DETAIL,
        signature: {
          id: 'sig1',
          signerName: 'Sam Signer',
          contentType: 'image/svg+xml',
          sizeBytes: 500,
          contentPath: `/api/v1/admin/returns/${RETURN_ID}/signature/content`,
          signedAt: '2026-08-06T03:00:00Z',
        },
      }),
    );
    renderReturnDetails();

    await waitFor(() => expect(screen.getByText(/Signed by Sam Signer on 6 Aug 2026.*\(Sydney time\)/)).toBeInTheDocument());
    const image = await screen.findByRole('img', { name: 'Customer signature from Sam Signer' });
    expect(image.tagName).toBe('IMG');
  });

  it('isolates a signature content failure from the rest of the page, with Retry available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const rawUrl = typeof input === 'string' ? input : (input as Request).url;
        if (rawUrl.includes('/signature/content')) {
          return jsonResponse(500, {});
        }
        return jsonResponse(200, {
          ...DETAIL,
          signature: {
            id: 'sig1',
            signerName: 'Sam Signer',
            contentType: 'image/svg+xml',
            sizeBytes: 500,
            contentPath: `/api/v1/admin/returns/${RETURN_ID}/signature/content`,
            signedAt: '2026-08-06T03:00:00Z',
          },
        });
      }),
    );

    renderReturnDetails();

    await waitFor(() => expect(screen.getByText(/Signed by Sam Signer/)).toBeInTheDocument());
    expect(screen.getByText('Acme Pty Ltd')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument());
  });
});
