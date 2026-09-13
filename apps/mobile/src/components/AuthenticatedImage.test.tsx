import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { authorizedMediaRequest } from '../api/apiClient';
import AuthenticatedImage from './AuthenticatedImage';

jest.mock('../api/apiClient', () => ({ authorizedMediaRequest: jest.fn() }));

const mockedMediaRequest = authorizedMediaRequest as jest.Mock;

function jpegBlob() {
  return new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' });
}

describe('AuthenticatedImage', () => {
  // The first render in this file pays a one-time cost to initialise the
  // module tree. On a cold jest cache — the condition CI starts in — that
  // alone outlasted the default waitFor window, so it is paid here rather
  // than inside whichever test happens to run first.
  beforeAll(async () => {
    mockedMediaRequest.mockResolvedValue(jpegBlob());
    const view = render(<AuthenticatedImage contentPath="/warmup" accessibilityLabel="warmup" testID="warmup" />);
    // The generous window is the point: this is the cold-start cost itself,
    // the same remedy the other screen tests document for a slow first mount.
    await waitFor(() => expect(screen.getByTestId('warmup')).toBeTruthy(), { timeout: 30000 });
    view.unmount();
  }, 60000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedMediaRequest.mockResolvedValue(jpegBlob());
  });

  it('fetches the private bytes through the authenticated client, never as a public URL', async () => {
    render(<AuthenticatedImage contentPath="/api/v1/driver/returns/r1/photos/p1/content" accessibilityLabel="Photo 1" testID="photo" />);

    await waitFor(() => expect(screen.getByTestId('photo')).toBeTruthy());

    // The API-relative path is handed to the client, which supplies the bearer
    // token as a header — so no token or storage key ever reaches a URL.
    expect(mockedMediaRequest).toHaveBeenCalledWith('/api/v1/driver/returns/r1/photos/p1/content');
    expect(mockedMediaRequest).toHaveBeenCalledTimes(1);
  });

  it('renders the resolved local uri rather than the remote path', async () => {
    render(<AuthenticatedImage contentPath="/api/v1/driver/returns/r1/photos/p1/content" accessibilityLabel="Photo 1" testID="photo" />);

    const image = await screen.findByTestId('photo');
    const uri = image.props.source.uri as string;

    expect(uri).toBeTruthy();
    expect(uri).not.toContain('/api/v1/');
    expect(image.props.accessibilityLabel).toBe('Photo 1');
    // `cover` keeps the photo undistorted inside a compact square.
    expect(image.props.resizeMode).toBe('cover');
  });

  it('shows a loading tile first, and never crashes while the bytes are in flight', async () => {
    let resolveMedia: (blob: Blob) => void = () => {};
    mockedMediaRequest.mockReturnValue(new Promise<Blob>((resolve) => { resolveMedia = resolve; }));

    render(<AuthenticatedImage contentPath="/x" accessibilityLabel="Photo 1" testID="photo" />);

    expect(screen.getByTestId('photo-loading')).toBeTruthy();
    expect(screen.queryByTestId('photo')).toBeNull();

    resolveMedia(jpegBlob());
    await waitFor(() => expect(screen.getByTestId('photo')).toBeTruthy());
  });

  it('shows a compact retry tile when the media cannot be loaded, without leaking backend detail', async () => {
    mockedMediaRequest.mockRejectedValue(new Error('raw backend detail that must never be shown'));

    render(<AuthenticatedImage contentPath="/x" accessibilityLabel="Photo 1" testID="photo" />);

    await waitFor(() => expect(screen.getByTestId('photo-failed')).toBeTruthy());
    expect(screen.getByText('Tap to retry')).toBeTruthy();
    expect(screen.queryByText(/raw backend detail/)).toBeNull();
  });

  it('retries the fetch when the failure tile is pressed', async () => {
    mockedMediaRequest.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(jpegBlob());

    render(<AuthenticatedImage contentPath="/x" accessibilityLabel="Photo 1" testID="photo" />);
    await waitFor(() => expect(screen.getByTestId('photo-failed')).toBeTruthy());

    fireEvent.press(screen.getByTestId('photo-failed'));

    await waitFor(() => expect(screen.getByTestId('photo')).toBeTruthy());
    expect(mockedMediaRequest).toHaveBeenCalledTimes(2);
  });
});
