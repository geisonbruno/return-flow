import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests, setAccessToken } from '../api/apiClient';
import { AuthenticatedImage } from './AuthenticatedImage';

function renderImage(contentPath: string, alt = 'Test image') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthenticatedImage contentPath={contentPath} alt={alt} />
    </QueryClientProvider>,
  );
}

describe('AuthenticatedImage', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn<(obj: Blob | MediaSource) => string>>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeEach(() => {
    resetApiClientForTests();
    setAccessToken('test-access-token');
    createObjectURLSpy = vi.fn(() => 'blob:mock-url');
    revokeObjectURLSpy = vi.fn();
    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = revokeObjectURLSpy;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state, then renders the image after a successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['fake-bytes'], { type: 'image/jpeg' }), { status: 200 })));

    const { container } = renderImage('/admin/returns/r1/photos/p1/content');
    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:mock-url');
  });

  it('never puts a token or any query-string credential in the img src', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['fake-bytes']), { status: 200 })));

    const { container } = renderImage('/admin/returns/r1/photos/p1/content');
    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());

    const src = container.querySelector('img')?.getAttribute('src') ?? '';
    expect(src).not.toContain('test-access-token');
    expect(src).not.toMatch(/token=/i);
  });

  it('attaches the bearer token on the underlying fetch, exactly like any other authenticated request', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(new Blob(['fake-bytes']), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    renderImage('/admin/returns/r1/photos/p1/content');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-access-token');
  });

  it('shows a retryable inline error on fetch failure, without crashing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 500, headers: { 'Content-Type': 'application/json' } })));

    renderImage('/admin/returns/r1/photos/p1/content');

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('retries the fetch when Retry is clicked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(new Blob(['fake-bytes']), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderImage('/admin/returns/r1/photos/p1/content');
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    screen.getByRole('button', { name: 'Retry' }).click();

    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('revokes the object URL when the component unmounts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['fake-bytes']), { status: 200 })));

    const { unmount, container } = renderImage('/admin/returns/r1/photos/p1/content');
    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());

    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });
});
