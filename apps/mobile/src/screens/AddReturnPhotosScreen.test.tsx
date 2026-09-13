import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';

import { authorizedMediaRequest } from '../api/apiClient';
import { normalizePhotoToJpeg } from '../returns/photoNormalization';
import { createReturn, listReturnPhotos, uploadReturnPhoto } from '../returns/returnService';
import AddReturnPhotosScreen from './AddReturnPhotosScreen';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('../returns/photoNormalization', () => ({
  normalizePhotoToJpeg: jest.fn(),
}));

jest.mock('../returns/returnService', () => ({
  listReturnPhotos: jest.fn(),
  uploadReturnPhoto: jest.fn(),
  createReturn: jest.fn(),
}));

jest.mock('../api/apiClient', () => ({ authorizedMediaRequest: jest.fn() }));

const ASSET = { uri: 'file:///picked.jpg', width: 1200, height: 900 };
const NORMALIZED = { uri: 'file:///normalized.jpg', width: 1200, height: 900, contentType: 'image/jpeg' as const, sizeBytes: 1000 };

function buildProps(returnId = 'return-1', origin: 'created' | 'details' = 'details') {
  return {
    navigation: { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() },
    route: { params: { returnId, origin } },
  };
}

describe('AddReturnPhotosScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listReturnPhotos as jest.Mock).mockResolvedValue([]);
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [ASSET] });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [ASSET] });
    (normalizePhotoToJpeg as jest.Mock).mockResolvedValue(NORMALIZED);
    (uploadReturnPhoto as jest.Mock).mockResolvedValue({ id: 'photo-1', contentType: 'image/jpeg', sizeBytes: 1000, position: 1, contentPath: '/x', createdAt: '' });
    // Left pending by default: tests that are not about thumbnails then have
    // no late media state update to await, and their assertions stay about the
    // behaviour they actually cover. The thumbnail tests below opt in.
    (authorizedMediaRequest as jest.Mock).mockReturnValue(new Promise(() => {}));
  });

  it(
    'renders the current uploaded photo count',
    async () => {
      (listReturnPhotos as jest.Mock).mockResolvedValue([
        { id: 'p1', contentType: 'image/jpeg', sizeBytes: 1, position: 1, contentPath: '/x', createdAt: '' },
        { id: 'p2', contentType: 'image/jpeg', sizeBytes: 1, position: 2, contentPath: '/x', createdAt: '' },
      ]);
      render(<AddReturnPhotosScreen {...(buildProps() as any)} />);

      // This is the first render() in the file, so it alone pays a one-time
      // React Native native-mock/module initialization cost that later tests
      // in this file never pay again — on constrained GitHub-hosted CI
      // runners that cost can occasionally exceed Jest's default 5000ms
      // waitFor/test window even though the screen's own loading-to-ready
      // transition is fast and correct. A longer timeout here (both on the
      // wait and on the test itself) is the correct remedy for a slow first
      // mount, not a synchronization bug — see the identical, previously
      // fixed pattern in ReturnListScreen.test.tsx.
      await waitFor(
        () => {
          expect(screen.getByTestId('photo-count')).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.getByTestId('photo-count').props.children.join('')).toBe('2 of 5 photos uploaded');
      expect(screen.queryByText('Loading photos…')).toBeNull();
    },
    10000,
  );

  it('requests media library permission when adding from the library', async () => {
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled());
  });

  it('requests camera permission when taking a photo', async () => {
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('take-photo-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('take-photo-button'));

    await waitFor(() => expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled());
  });

  it('shows a clear message when library permission is denied', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(screen.getByText(/Photo library access is required/)).toBeTruthy());
  });

  it('shows a clear message when camera permission is denied', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('take-photo-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('take-photo-button'));

    await waitFor(() => expect(screen.getByText(/Camera access is required/)).toBeTruthy());
  });

  it('renders a local preview of a selected photo before the upload settles', async () => {
    let resolveNormalize: (value: typeof NORMALIZED) => void = () => {};
    (normalizePhotoToJpeg as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveNormalize = resolve; }));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(screen.getByTestId('queued-photo')).toBeTruthy());
    resolveNormalize(NORMALIZED);
    await waitFor(() => expect(uploadReturnPhoto).toHaveBeenCalled());
  });

  it('allows removing a locally selected photo before the upload starts', async () => {
    let resolveNormalize: (value: typeof NORMALIZED) => void = () => {};
    (normalizePhotoToJpeg as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveNormalize = resolve; }));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));
    await waitFor(() => expect(screen.getByTestId('queued-photo')).toBeTruthy());

    fireEvent.press(screen.getAllByText('Remove')[0]);

    expect(screen.queryByTestId('queued-photo')).toBeNull();
    expect(uploadReturnPhoto).not.toHaveBeenCalled();

    // Even though normalization resolves afterward, the removal must stick —
    // a slow background normalize/upload must never resurrect a removed photo.
    resolveNormalize(NORMALIZED);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button').props.accessibilityState.disabled).toBe(false));
    expect(uploadReturnPhoto).not.toHaveBeenCalled();
    expect(screen.queryByTestId('queued-photo')).toBeNull();
  });

  it('prevents adding or uploading more than five total photos', async () => {
    (listReturnPhotos as jest.Mock).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`,
        contentType: 'image/jpeg',
        sizeBytes: 1,
        position: i + 1,
        contentPath: '/x',
        createdAt: '',
      })),
    );
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByTestId('photo-count')).toBeTruthy());
    expect(screen.getByTestId('add-from-library-button').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('add-from-library-button'));
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('prevents a duplicate library pick while one is already in progress', async () => {
    let resolvePermission: (value: { granted: boolean }) => void = () => {};
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockReturnValue(
      new Promise((resolve) => { resolvePermission = resolve; }),
    );
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));
    fireEvent.press(screen.getByTestId('add-from-library-button'));
    fireEvent.press(screen.getByTestId('add-from-library-button'));
    resolvePermission({ granted: true });

    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  });

  it('updates the uploaded photo count after a successful upload', async () => {
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('photo-count')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(screen.getByTestId('photo-count').props.children.join('')).toBe('1 of 5 photos uploaded'));
  });

  it('does not increment the uploaded count when an upload fails', async () => {
    (uploadReturnPhoto as jest.Mock).mockRejectedValue(new Error('network blip'));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('photo-count')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeTruthy());
    expect(screen.getByTestId('photo-count').props.children.join('')).toBe('0 of 5 photos uploaded');
  });

  it('keeps a failed local selection visible with Retry and Remove and a clear error message', async () => {
    (uploadReturnPhoto as jest.Mock).mockRejectedValue(new Error('network blip'));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeTruthy());
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.getAllByText('Remove').length).toBeGreaterThan(0);
  });

  it('allows retrying a failed upload, incrementing the count exactly once, without creating the return again', async () => {
    (uploadReturnPhoto as jest.Mock)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ id: 'photo-1', contentType: 'image/jpeg', sizeBytes: 1000, position: 1, contentPath: '/x', createdAt: '' });
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));
    await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeTruthy());

    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByTestId('photo-count').props.children.join('')).toBe('1 of 5 photos uploaded'));
    expect(uploadReturnPhoto).toHaveBeenCalledTimes(2);
    expect(createReturn).not.toHaveBeenCalled();
  });

  it('states that the return itself was already created when an upload fails', async () => {
    (uploadReturnPhoto as jest.Mock).mockRejectedValue(new Error('network blip'));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(screen.getByText(/return itself was already created/)).toBeTruthy());
  });

  it('Skip navigates to Return Details for this return', async () => {
    const props = buildProps('return-42');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('skip-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('skip-button'));

    expect(props.navigation.replace).toHaveBeenCalledWith('ReturnDetails', { returnId: 'return-42' });
  });

  it('Skip remains available and does not claim a failed photo was uploaded', async () => {
    (uploadReturnPhoto as jest.Mock).mockRejectedValue(new Error('network blip'));
    const props = buildProps('return-42');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));
    await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeTruthy());

    expect(screen.getByTestId('skip-button').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('skip-button'));

    expect(props.navigation.replace).toHaveBeenCalledWith('ReturnDetails', { returnId: 'return-42' });
    expect(screen.getByTestId('photo-count').props.children.join('')).toBe('0 of 5 photos uploaded');
  });

  it('Finish navigates to Return Details for this return when there is nothing pending', async () => {
    const props = buildProps('return-42');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('finish-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('finish-button'));

    expect(props.navigation.replace).toHaveBeenCalledWith('ReturnDetails', { returnId: 'return-42' });
  });

  it('disables Finish while a photo is uploading', async () => {
    let resolveUpload: (value: unknown) => void = () => {};
    (uploadReturnPhoto as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(screen.getByTestId('finish-button').props.accessibilityState.disabled).toBe(true));
    resolveUpload({ id: 'photo-1', contentType: 'image/jpeg', sizeBytes: 1000, position: 1, contentPath: '/x', createdAt: '' });
    await waitFor(() => expect(screen.getByTestId('finish-button').props.accessibilityState.disabled).toBe(false));
  });

  it('disables Finish while a selected photo remains failed, and does not claim it was uploaded', async () => {
    (uploadReturnPhoto as jest.Mock).mockRejectedValue(new Error('network blip'));
    const props = buildProps('return-42');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeTruthy());
    expect(screen.getByTestId('finish-button').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('finish-button'));
    expect(props.navigation.replace).not.toHaveBeenCalled();
  });

  it('re-enables Finish once a failed photo is removed', async () => {
    (uploadReturnPhoto as jest.Mock).mockRejectedValue(new Error('network blip'));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));
    await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeTruthy());
    expect(screen.getByTestId('finish-button').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getAllByText('Remove')[0]);

    expect(screen.getByTestId('finish-button').props.accessibilityState.disabled).toBe(false);
  });

  it('re-enables Finish once a failed photo is retried successfully', async () => {
    (uploadReturnPhoto as jest.Mock)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ id: 'photo-1', contentType: 'image/jpeg', sizeBytes: 1000, position: 1, contentPath: '/x', createdAt: '' });
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));
    await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeTruthy());
    expect(screen.getByTestId('finish-button').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByTestId('finish-button').props.accessibilityState.disabled).toBe(false));
  });

  it('does not start a second upload from a fast repeated Retry tap', async () => {
    let resolveCount = 0;
    (uploadReturnPhoto as jest.Mock)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCount += 1;
            setTimeout(
              () => resolve({ id: 'photo-1', contentType: 'image/jpeg', sizeBytes: 1000, position: 1, contentPath: '/x', createdAt: '' }),
              10,
            );
          }),
      );
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-from-library-button'));
    await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeTruthy());

    // Captures one element reference and presses it twice without
    // re-querying, so this exercises the duplicate-tap guard itself
    // (inFlightUploads) rather than merely the Retry button's own
    // disappearance once the status changes — a fast double-tap can fire
    // before React re-renders, so the guard must not rely on that alone.
    const retryButton = screen.getByText('Retry');
    fireEvent.press(retryButton);
    fireEvent.press(retryButton);

    await waitFor(() => expect(screen.getByTestId('photo-count').props.children.join('')).toBe('1 of 5 photos uploaded'));
    expect(resolveCount).toBe(1);
  });

  it('five-photo capacity counts remote photos plus a current local selection together', async () => {
    (listReturnPhotos as jest.Mock).mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({
        id: `p${i}`,
        contentType: 'image/jpeg',
        sizeBytes: 1,
        position: i + 1,
        contentPath: '/x',
        createdAt: '',
      })),
    );
    let resolveNormalize: (value: typeof NORMALIZED) => void = () => {};
    (normalizePhotoToJpeg as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveNormalize = resolve; }));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-from-library-button')).toBeTruthy());
    // 4 already uploaded, none locally selected yet — one slot remains.
    expect(screen.getByTestId('add-from-library-button').props.accessibilityState.disabled).toBe(false);

    // Selecting a 5th (still normalizing, not yet uploaded) must already
    // fill capacity — 4 uploaded + 1 local selection = 5.
    fireEvent.press(screen.getByTestId('add-from-library-button'));
    await waitFor(() => expect(screen.getByTestId('queued-photo')).toBeTruthy());

    expect(screen.getByTestId('add-from-library-button').props.accessibilityState.disabled).toBe(true);
    resolveNormalize(NORMALIZED);
    await waitFor(() => expect(uploadReturnPhoto).toHaveBeenCalled());
  });

  it('Skip navigates to Customer Signature, not Return Details, for a newly created return (origin: created)', async () => {
    const props = buildProps('return-42', 'created');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('skip-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('skip-button'));

    expect(props.navigation.replace).toHaveBeenCalledWith('CustomerSignature', { returnId: 'return-42' });
  });

  it('Finish navigates to Customer Signature, not Return Details, for a newly created return (origin: created)', async () => {
    const props = buildProps('return-42', 'created');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('finish-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('finish-button'));

    expect(props.navigation.replace).toHaveBeenCalledWith('CustomerSignature', { returnId: 'return-42' });
  });

  it('Finish navigates back to Return Details, not Customer Signature, when adding photos from Return Details (origin: details)', async () => {
    const props = buildProps('return-42', 'details');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('finish-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('finish-button'));

    expect(props.navigation.replace).toHaveBeenCalledWith('ReturnDetails', { returnId: 'return-42' });
  });

  it('frames the screen as step 2 of the guided flow, with Details already completed', async () => {
    render(<AddReturnPhotosScreen {...(buildProps('return-42', 'created') as any)} />);
    await waitFor(() => expect(screen.getByTestId('photo-count')).toBeTruthy());

    expect(screen.getByRole('header', { name: 'Add Photos' })).toBeTruthy();
    expect(screen.getByTestId('step-indicator')).toBeTruthy();
    for (const label of ['Details', 'Photos', 'Signature', 'Review']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    expect(screen.getByLabelText('Step 1 of 4, Details, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 2 of 4, Photos, current')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 4, Signature, upcoming')).toBeTruthy();
    expect(screen.getByLabelText('Step 4 of 4, Review, upcoming')).toBeTruthy();

    expect(screen.getByTestId('step-2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('step-1').props.accessibilityState.selected).toBe(false);
  });

  it('shows the empty photo placeholder only while no photo exists', async () => {
    (authorizedMediaRequest as jest.Mock).mockResolvedValue(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('photo-placeholder')).toBeTruthy());
    expect(screen.getByText(/Add photos of the item, packaging/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('add-from-library-button'));

    // Once a photo exists the large placeholder gives way to the thumbnails.
    await waitFor(() => expect(screen.getByTestId('uploaded-photo-image-1')).toBeTruthy());
    expect(screen.queryByTestId('photo-placeholder')).toBeNull();
  });

  it('reports the real uploaded count rather than a fixed zero', async () => {
    (authorizedMediaRequest as jest.Mock).mockResolvedValue(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    (listReturnPhotos as jest.Mock).mockResolvedValue([
      { id: 'p1', contentType: 'image/jpeg', sizeBytes: 1, position: 1, contentPath: '/a', createdAt: '' },
      { id: 'p2', contentType: 'image/jpeg', sizeBytes: 1, position: 2, contentPath: '/b', createdAt: '' },
      { id: 'p3', contentType: 'image/jpeg', sizeBytes: 1, position: 3, contentPath: '/c', createdAt: '' },
    ]);
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByTestId('photo-count').props.children.join('')).toBe('3 of 5 photos uploaded'));
    await waitFor(() => expect(screen.getByTestId('uploaded-photo-image-3')).toBeTruthy());
  });

  it('sends Continue into the existing Signature step for the real return, in the created flow', async () => {
    const props = buildProps('return-42', 'created');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('finish-button')).toBeTruthy());

    expect(screen.getByText('Continue')).toBeTruthy();
    fireEvent.press(screen.getByTestId('finish-button'));

    expect(props.navigation.replace).toHaveBeenCalledWith('CustomerSignature', { returnId: 'return-42' });
  });

  it('gives Skip for now the same destination as Continue, with no extra side effect', async () => {
    const props = buildProps('return-42', 'created');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('skip-button')).toBeTruthy());

    expect(screen.getByText('Skip for now')).toBeTruthy();
    fireEvent.press(screen.getByTestId('skip-button'));

    // Both express different intent but share one transition; no "skipped"
    // state is invented, and nothing is uploaded.
    expect(props.navigation.replace).toHaveBeenCalledWith('CustomerSignature', { returnId: 'return-42' });
    expect(uploadReturnPhoto).not.toHaveBeenCalled();
  });

  it('goes back without creating another return', async () => {
    const props = buildProps('return-42', 'created');
    render(<AddReturnPhotosScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-photos-back-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-photos-back-button'));

    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
    // The return already exists at this step; back must never re-create it.
    expect(createReturn).not.toHaveBeenCalled();
    expect(props.navigation.replace).not.toHaveBeenCalled();
  });

  it('renders the real authenticated thumbnail for a persisted photo, not a metadata tile', async () => {
    (authorizedMediaRequest as jest.Mock).mockResolvedValue(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    (listReturnPhotos as jest.Mock).mockResolvedValue([
      { id: 'p1', contentType: 'image/jpeg', sizeBytes: 1, position: 1, contentPath: '/api/v1/driver/returns/r1/photos/p1/content', createdAt: '' },
    ]);
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByTestId('uploaded-photo-image-1')).toBeTruthy());

    // Fetched through the authenticated client, so no token or storage key
    // ever reaches a URL, and the rendered uri is local rather than remote.
    expect(authorizedMediaRequest).toHaveBeenCalledWith('/api/v1/driver/returns/r1/photos/p1/content');
    expect(screen.getByTestId('uploaded-photo-image-1').props.source.uri).not.toContain('/api/v1/');
    // The old metadata-only tile is gone.
    expect(screen.queryByText('Photo 1')).toBeNull();
    expect(screen.queryByText('Uploaded')).toBeNull();
  });

  it('renders every persisted photo in position order', async () => {
    (authorizedMediaRequest as jest.Mock).mockResolvedValue(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    (listReturnPhotos as jest.Mock).mockResolvedValue([
      { id: 'p1', contentType: 'image/jpeg', sizeBytes: 1, position: 1, contentPath: '/a', createdAt: '' },
      { id: 'p2', contentType: 'image/jpeg', sizeBytes: 1, position: 2, contentPath: '/b', createdAt: '' },
      { id: 'p3', contentType: 'image/jpeg', sizeBytes: 1, position: 3, contentPath: '/c', createdAt: '' },
    ]);
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByTestId('uploaded-photo-image-3')).toBeTruthy());
    for (const position of [1, 2, 3]) {
      expect(screen.getByTestId(`uploaded-photo-${position}`)).toBeTruthy();
    }
    expect(screen.getByTestId('photo-count').props.children.join('')).toBe('3 of 5 photos uploaded');
    // Rendering thumbnails must never trigger an upload.
    expect(uploadReturnPhoto).not.toHaveBeenCalled();
  });

  it('keeps the screen usable when a thumbnail cannot be loaded', async () => {
    (authorizedMediaRequest as jest.Mock).mockRejectedValue(new Error('media offline'));
    (listReturnPhotos as jest.Mock).mockResolvedValue([
      { id: 'p1', contentType: 'image/jpeg', sizeBytes: 1, position: 1, contentPath: '/a', createdAt: '' },
    ]);
    render(<AddReturnPhotosScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByTestId('uploaded-photo-image-1-failed')).toBeTruthy());
    // A failed photo degrades to a retry tile; the rest of the step still works.
    expect(screen.getByTestId('photo-count').props.children.join('')).toBe('1 of 5 photos uploaded');
    expect(screen.getByTestId('add-from-library-button')).toBeTruthy();
    expect(screen.getByTestId('finish-button')).toBeTruthy();
  });
});
