import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '../api/apiClient';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { NavigationGuardProvider } from '../routes/navigationGuard';
import { ReturnDetailsPage } from './ReturnDetailsPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const RETURN_ID = '11111111-1111-1111-1111-111111111111';
const ME_ID = 'admin-1';
const OTHER_ADMIN_ID = 'admin-2';

const AUTH_VALUE: AuthContextValue = {
  status: 'authenticated',
  user: { userId: ME_ID, fullName: 'Ada Admin', email: 'ada@warehouse.example', role: 'ADMIN', tenantId: 'tenant-1', tenantName: 'Warehouse' },
  sessionMessage: null,
  login: vi.fn(),
  logout: vi.fn(),
};

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
  reviewer: null as unknown,
  reviewStartedAt: null as unknown,
  sellable: null as unknown,
  creditCustomer: null as unknown,
  chargeCustomer: null as unknown,
  chargeDriver: null as unknown,
  warehouseObservation: null as unknown,
  warehouseRepresentativeName: null as unknown,
  warehouseSignature: null as unknown,
  closedBy: null as unknown,
  closedAt: null as unknown,
  cancelledBy: null as unknown,
  cancelledAt: null as unknown,
  cancellationReason: null as unknown,
  createdAt: '2026-08-06T02:15:00Z',
  updatedAt: '2026-08-06T02:15:00Z',
};

function renderReturnDetails(path: string = `/returns/${RETURN_ID}`, authValue: AuthContextValue = AUTH_VALUE) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[path]}>
          <NavigationGuardProvider>
            <Routes>
              <Route path="/returns/:returnId" element={<ReturnDetailsPage />} />
              <Route path="/returns" element={<div>Returns Page</div>} />
            </Routes>
          </NavigationGuardProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

/** jsdom's `getBoundingClientRect` (defined on `Element.prototype`, not `SVGElement.prototype`) always returns zeros — stub a real-looking rect so the warehouse signature pad can compute normalized coordinates. */
function stubSignaturePadRect() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 300,
    bottom: 150,
    width: 300,
    height: 150,
    toJSON: () => ({}),
  });
}

function drawWarehouseSignature(container: HTMLElement) {
  const svg = container.querySelector('.warehouse-signature-pad') as SVGSVGElement;
  // Dispatched directly (not via `fireEvent`), so each event is wrapped in
  // `act()` to flush the resulting state update before the caller continues
  // — otherwise React defers it to a microtask that runs after the next
  // synchronous assertion, and the drawn stroke silently "isn't there yet".
  function dispatch(type: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number, clientY: number) {
    act(() => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }) as unknown as PointerEvent;
      Object.defineProperty(event, 'pointerId', { value: 1 });
      svg.dispatchEvent(event);
    });
  }
  dispatch('pointerdown', 10, 10);
  dispatch('pointermove', 200, 120);
  dispatch('pointerup', 200, 120);
}

/**
 * A dispatcher-style fetch mock for the Phase 7A lifecycle endpoints, used
 * by every test below that exercises Start Review/Release/Takeover/Close/
 * Cancel — a single `detail` object is mutated in place by the handlers so
 * each test controls exactly what the "current authoritative state" looks
 * like before and after an action, without re-declaring routing logic.
 */
interface LifecycleHandlers {
  startReview?: () => Response | Promise<Response>;
  releaseReview?: () => Response | Promise<Response>;
  takeOverReview?: () => Response | Promise<Response>;
  close?: () => Response | Promise<Response>;
  cancel?: () => Response | Promise<Response>;
}

function stubLifecycleFetch(getDetail: () => unknown, handlers: LifecycleHandlers = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : (input as Request).url;
    const url = new URL(rawUrl, 'http://localhost');
    if (url.pathname.includes('/photos/') || url.pathname.endsWith('/signature/content') || url.pathname.endsWith('/warehouse-signature/content')) {
      return new Response(new Blob(['bytes'], { type: 'image/svg+xml' }), { status: 200 });
    }
    if (url.pathname.endsWith('/start-review')) return handlers.startReview ? handlers.startReview() : jsonResponse(200, getDetail());
    if (url.pathname.endsWith('/release-review')) return handlers.releaseReview ? handlers.releaseReview() : jsonResponse(200, getDetail());
    if (url.pathname.endsWith('/take-over-review')) return handlers.takeOverReview ? handlers.takeOverReview() : jsonResponse(200, getDetail());
    if (url.pathname.endsWith('/close')) return handlers.close ? handlers.close() : jsonResponse(200, getDetail());
    if (url.pathname.endsWith('/cancel')) return handlers.cancel ? handlers.cancel() : jsonResponse(200, getDetail());
    void init;
    return jsonResponse(200, getDetail());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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

  describe('warehouse review lifecycle (Phase 7B)', () => {
    beforeEach(() => {
      stubSignaturePadRect();
    });

    it('does not call Start Review merely by opening AWAITING_WAREHOUSE details', async () => {
      const fetchMock = stubLifecycleFetch(() => DETAIL);
      renderReturnDetails();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Start Review' })).toBeInTheDocument());
      expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/start-review'))).toBe(false);
    });

    it('Start Review success transitions to IN_REVIEW and shows the reviewer', async () => {
      let currentDetail: unknown = DETAIL;
      stubLifecycleFetch(() => currentDetail, {
        startReview: () => {
          currentDetail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
          return jsonResponse(200, currentDetail);
        },
      });
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Start Review' })).toBeInTheDocument());

      await act(async () => {
        screen.getByRole('button', { name: 'Start Review' }).click();
      });

      await waitFor(() => expect(screen.getByText(/In review by you/)).toBeInTheDocument());
    });

    it('a Start Review conflict shows the actual current reviewer and refetches authoritative state', async () => {
      let currentDetail: unknown = DETAIL;
      stubLifecycleFetch(() => currentDetail, {
        startReview: () => {
          currentDetail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: OTHER_ADMIN_ID, fullName: 'Other Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
          return jsonResponse(409, {
            title: 'Return Already In Review',
            detail: 'Another admin already started reviewing this return.',
            currentReviewerName: 'Other Admin',
          });
        },
      });
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Start Review' })).toBeInTheDocument());

      await act(async () => {
        screen.getByRole('button', { name: 'Start Review' }).click();
      });

      await waitFor(() => expect(screen.getByText(/Current reviewer: Other Admin\./)).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText(/In review by Other Admin/)).toBeInTheDocument());
    });

    it('the current reviewer sees the editable warehouse review form', async () => {
      const detail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      stubLifecycleFetch(() => detail);
      renderReturnDetails();

      await waitFor(() => expect(screen.getByText(/In review by you/)).toBeInTheDocument());
      expect(screen.getByRole('group', { name: 'Sellable' })).toBeInTheDocument();
      expect(screen.getByLabelText('Warehouse representative name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close Return' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Release Review' })).toBeInTheDocument();
    });

    it('a non-owner ADMIN sees a read-only banner and Take Over Review, not the editable form', async () => {
      const detail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: OTHER_ADMIN_ID, fullName: 'Other Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      stubLifecycleFetch(() => detail);
      renderReturnDetails();

      await waitFor(() => expect(screen.getByText(/In review by Other Admin/)).toBeInTheDocument());
      expect(screen.queryByLabelText('Warehouse representative name')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Take Over Review' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Close Return' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Release Review' })).not.toBeInTheDocument();
    });

    it('Release Review success returns the return to AWAITING_WAREHOUSE and clears the form', async () => {
      let currentDetail: unknown = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      stubLifecycleFetch(() => currentDetail, {
        releaseReview: () => {
          currentDetail = { ...DETAIL, status: 'AWAITING_WAREHOUSE', reviewer: null, reviewStartedAt: null };
          return jsonResponse(200, currentDetail);
        },
      });
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Release Review' })).toBeInTheDocument());

      await act(async () => {
        screen.getByRole('button', { name: 'Release Review' }).click();
      });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      await act(async () => {
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Release Review' }).click();
      });

      await waitFor(() => expect(screen.getByRole('button', { name: 'Start Review' })).toBeInTheDocument());
    });

    it('Release Review confirmation warns when the form has unsaved values', async () => {
      const detail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      stubLifecycleFetch(() => detail);
      renderReturnDetails();
      await waitFor(() => expect(screen.getByLabelText('Warehouse representative name')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText('Warehouse representative name'), { target: { value: 'Wes Warehouse' } });

      await act(async () => {
        screen.getByRole('button', { name: 'Release Review' }).click();
      });

      await waitFor(() => expect(screen.getByText(/Unsaved review information will be discarded\./)).toBeInTheDocument());
    });

    it('Take Over Review reassigns ownership and starts the new owner with an empty form', async () => {
      let currentDetail: unknown = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: OTHER_ADMIN_ID, fullName: 'Other Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      stubLifecycleFetch(() => currentDetail, {
        takeOverReview: () => {
          currentDetail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T05:00:00Z' };
          return jsonResponse(200, currentDetail);
        },
      });
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Take Over Review' })).toBeInTheDocument());

      await act(async () => {
        screen.getByRole('button', { name: 'Take Over Review' }).click();
      });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      await act(async () => {
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Take Over Review' }).click();
      });

      await waitFor(() => expect(screen.getByText(/In review by you/)).toBeInTheDocument());
      expect(screen.getByLabelText('Warehouse representative name')).toHaveValue('');
    });

    it('a stale Take Over Review conflict shows the new current reviewer and refetches', async () => {
      let currentDetail: unknown = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: OTHER_ADMIN_ID, fullName: 'Other Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      stubLifecycleFetch(() => currentDetail, {
        takeOverReview: () => {
          currentDetail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: 'admin-3', fullName: 'Third Admin' }, reviewStartedAt: '2026-08-06T04:30:00Z' };
          return jsonResponse(409, {
            title: 'Stale Takeover',
            detail: 'The current reviewer has changed since this was last observed.',
            currentReviewerName: 'Third Admin',
          });
        },
      });
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Take Over Review' })).toBeInTheDocument());

      await act(async () => {
        screen.getByRole('button', { name: 'Take Over Review' }).click();
      });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      await act(async () => {
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Take Over Review' }).click();
      });

      await waitFor(() => expect(screen.getByText(/Current reviewer: Third Admin\./)).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText(/In review by Third Admin/)).toBeInTheDocument());
    });

    it('rejects Close when required Yes/No decisions are unanswered, distinguishing unset from an explicit No', async () => {
      const detail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      const fetchMock = stubLifecycleFetch(() => detail);
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Close Return' })).toBeInTheDocument());

      // Only two of the four required decisions are answered; the other two stay unset.
      fireEvent.click(within(screen.getByRole('group', { name: 'Sellable' })).getByLabelText('No'));
      fireEvent.click(within(screen.getByRole('group', { name: 'Credit customer' })).getByLabelText('Yes'));

      await act(async () => {
        screen.getByRole('button', { name: 'Close Return' }).click();
      });

      expect(screen.getAllByText('Select Yes or No.')).toHaveLength(2);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/close'))).toBe(false);
    });

    it('a valid Close submission sends every required field and the normalized signature strokes together, and renders CLOSED on success', async () => {
      const detail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      const closedDetail = {
        ...detail,
        status: 'CLOSED',
        sellable: true,
        creditCustomer: false,
        chargeCustomer: true,
        chargeDriver: false,
        warehouseObservation: null,
        warehouseRepresentativeName: 'Wes Warehouse',
        warehouseSignature: {
          id: 'wsig1',
          signerName: 'Wes Warehouse',
          contentType: 'image/svg+xml',
          sizeBytes: 400,
          contentPath: `/api/v1/admin/returns/${RETURN_ID}/warehouse-signature/content`,
          signedAt: '2026-08-06T06:00:00Z',
        },
        closedBy: { id: ME_ID, fullName: 'Ada Admin' },
        closedAt: '2026-08-06T06:00:00Z',
      };
      const fetchMock = stubLifecycleFetch(() => detail, {
        close: () => jsonResponse(200, closedDetail),
      });
      const { container } = renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Close Return' })).toBeInTheDocument());

      fireEvent.click(within(screen.getByRole('group', { name: 'Sellable' })).getByLabelText('Yes'));
      fireEvent.click(within(screen.getByRole('group', { name: 'Credit customer' })).getByLabelText('No'));
      fireEvent.click(within(screen.getByRole('group', { name: 'Charge customer' })).getByLabelText('Yes'));
      fireEvent.click(within(screen.getByRole('group', { name: 'Charge driver' })).getByLabelText('No'));
      fireEvent.change(screen.getByLabelText('Warehouse representative name'), { target: { value: 'Wes Warehouse' } });
      drawWarehouseSignature(container);

      await act(async () => {
        screen.getByRole('button', { name: 'Close Return' }).click();
      });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      expect(screen.getByText('Sellable: Yes')).toBeInTheDocument();
      expect(screen.getByText('Warehouse representative: Wes Warehouse')).toBeInTheDocument();

      await act(async () => {
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Close Return' }).click();
      });

      await waitFor(() => expect(container.querySelector('.status-badge')).toHaveTextContent('Closed'));
      expect(screen.queryByRole('button', { name: 'Release Review' })).not.toBeInTheDocument();

      const closeCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/close'));
      expect(closeCall).toBeDefined();
      const body = JSON.parse((closeCall![1] as RequestInit).body as string);
      expect(body).toMatchObject({
        sellable: true,
        creditCustomer: false,
        chargeCustomer: true,
        chargeDriver: false,
        warehouseRepresentativeName: 'Wes Warehouse',
      });
      expect(Array.isArray(body.warehouseSignatureStrokes)).toBe(true);
      expect(body.warehouseSignatureStrokes.length).toBeGreaterThan(0);
      expect(body.warehouseSignatureStrokes[0].length).toBeGreaterThanOrEqual(2);
    });

    it('a failed Close preserves the entered form values for correction, without clearing the signature', async () => {
      const detail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      stubLifecycleFetch(() => detail, {
        close: () => jsonResponse(400, { title: 'Validation Error', detail: 'Validation failed for one or more fields.' }),
      });
      const { container } = renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Close Return' })).toBeInTheDocument());

      fireEvent.click(within(screen.getByRole('group', { name: 'Sellable' })).getByLabelText('Yes'));
      fireEvent.click(within(screen.getByRole('group', { name: 'Credit customer' })).getByLabelText('Yes'));
      fireEvent.click(within(screen.getByRole('group', { name: 'Charge customer' })).getByLabelText('No'));
      fireEvent.click(within(screen.getByRole('group', { name: 'Charge driver' })).getByLabelText('No'));
      fireEvent.change(screen.getByLabelText('Warehouse representative name'), { target: { value: 'Wes Warehouse' } });
      drawWarehouseSignature(container);

      await act(async () => {
        screen.getByRole('button', { name: 'Close Return' }).click();
      });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      await act(async () => {
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Close Return' }).click();
      });

      await waitFor(() => expect(screen.getByText('Validation failed for one or more fields.')).toBeInTheDocument());
      expect(screen.getByLabelText('Warehouse representative name')).toHaveValue('Wes Warehouse');
      expect(within(screen.getByRole('group', { name: 'Sellable' })).getByLabelText('Yes')).toBeChecked();
      expect(screen.getByRole('button', { name: 'Close Return' })).toBeInTheDocument();
    });

    it('renders the complete read-only warehouse decision summary for a CLOSED return, with the authenticated warehouse signature and no lifecycle actions', async () => {
      const closedDetail = {
        ...DETAIL,
        status: 'CLOSED',
        reviewer: { id: ME_ID, fullName: 'Ada Admin' },
        reviewStartedAt: '2026-08-06T04:00:00Z',
        sellable: true,
        creditCustomer: false,
        chargeCustomer: true,
        chargeDriver: false,
        warehouseObservation: 'Checked twice.',
        warehouseRepresentativeName: 'Wes Warehouse',
        warehouseSignature: {
          id: 'wsig1',
          signerName: 'Wes Warehouse',
          contentType: 'image/svg+xml',
          sizeBytes: 400,
          contentPath: `/api/v1/admin/returns/${RETURN_ID}/warehouse-signature/content`,
          signedAt: '2026-08-06T06:00:00Z',
        },
        closedBy: { id: ME_ID, fullName: 'Ada Admin' },
        closedAt: '2026-08-06T06:00:00Z',
      };
      stubLifecycleFetch(() => closedDetail);
      renderReturnDetails();

      await waitFor(() => expect(screen.getByText('Wes Warehouse')).toBeInTheDocument());
      expect(screen.getByText('Checked twice.')).toBeInTheDocument();
      const image = await screen.findByRole('img', { name: 'Warehouse signature from Wes Warehouse' });
      expect(image.tagName).toBe('IMG');

      expect(screen.queryByRole('button', { name: 'Start Review' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Close Return' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Release Review' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Take Over Review' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel Return' })).not.toBeInTheDocument();
    });

    it('Cancel requires a non-blank reason before it can be confirmed', async () => {
      stubLifecycleFetch(() => DETAIL);
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel Return' })).toBeInTheDocument());

      await act(async () => {
        screen.getByRole('button', { name: 'Cancel Return' }).click();
      });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel Return' });
      expect(confirmButton).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: 'Customer changed their mind' } });
      expect(confirmButton).not.toBeDisabled();
    });

    it('Cancel success renders the CANCELLED read-only state with no lifecycle actions remaining', async () => {
      let currentDetail: unknown = DETAIL;
      stubLifecycleFetch(() => currentDetail, {
        cancel: () => {
          currentDetail = {
            ...DETAIL,
            status: 'CANCELLED',
            cancellationReason: 'Customer changed their mind',
            cancelledBy: { id: ME_ID, fullName: 'Ada Admin' },
            cancelledAt: '2026-08-06T07:00:00Z',
          };
          return jsonResponse(200, currentDetail);
        },
      });
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel Return' })).toBeInTheDocument());

      await act(async () => {
        screen.getByRole('button', { name: 'Cancel Return' }).click();
      });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: 'Customer changed their mind' } });
      await act(async () => {
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel Return' }).click();
      });

      await waitFor(() => expect(screen.getByText('Customer changed their mind')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Start Review' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel Return' })).not.toBeInTheDocument();
    });

    it('warns before leaving via "Back to Returns" when the review form has unsaved values, and only leaves on confirmation', async () => {
      const detail = { ...DETAIL, status: 'IN_REVIEW', reviewer: { id: ME_ID, fullName: 'Ada Admin' }, reviewStartedAt: '2026-08-06T04:00:00Z' };
      stubLifecycleFetch(() => detail);
      renderReturnDetails();
      await waitFor(() => expect(screen.getByLabelText('Warehouse representative name')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText('Warehouse representative name'), { target: { value: 'Wes Warehouse' } });

      fireEvent.click(screen.getByText('← Back to Returns'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      expect(screen.getByText('Unsaved review information will be discarded.')).toBeInTheDocument();

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Stay' }));
      expect(screen.queryByText('Returns Page')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('← Back to Returns'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Leave' }));

      await waitFor(() => expect(screen.getByText('Returns Page')).toBeInTheDocument());
    });

    it('does not warn when leaving with no unsaved review values', async () => {
      stubLifecycleFetch(() => DETAIL);
      renderReturnDetails();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Start Review' })).toBeInTheDocument());

      fireEvent.click(screen.getByText('← Back to Returns'));

      await waitFor(() => expect(screen.getByText('Returns Page')).toBeInTheDocument());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
