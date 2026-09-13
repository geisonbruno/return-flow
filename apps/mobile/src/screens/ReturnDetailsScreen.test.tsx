import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ApiError } from '../api/problemDetails';
import { authorizedMediaRequest, authorizedMediaText } from '../api/apiClient';
import { formatDateTime } from '../returns/returnOptions';
import { getReturn } from '../returns/returnService';
import ReturnDetailsScreen from './ReturnDetailsScreen';

jest.mock('../returns/returnService');

// The screen now renders real authenticated media. Both fetches go through the
// app's own client, so stubbing it here keeps the tests off the network while
// still exercising the components' own logic.
jest.mock('../api/apiClient', () => ({
  authorizedMediaRequest: jest.fn(),
  authorizedMediaText: jest.fn(),
}));

const RECORD = {
  id: 'return-1',
  returnNumber: 'RF-000042',
  customerName: 'Market ABC',
  productName: 'Widget X200',
  reason: 'OTHER' as const,
  reasonDetails: 'Customer changed their mind',
  quantity: 3,
  unit: 'CTN' as const,
  observation: 'Box was open',
  status: 'AWAITING_WAREHOUSE' as const,
  driver: { id: 'd1', fullName: 'Driver One' },
  route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
  photos: [] as { id: string; contentType: string; sizeBytes: number; position: number; contentPath: string; createdAt: string }[],
  createdAt: '2026-08-02T01:15:00.000Z',
  updatedAt: '2026-08-02T01:15:00.000Z',
};

function buildProps(returnId: string, origin?: 'created') {
  return {
    navigation: { navigate: jest.fn(), goBack: jest.fn() },
    route: { params: { returnId, origin } },
  };
}

describe('ReturnDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Left pending by default, so tests that are not about media have no late
    // state update to await. The media tests below opt in.
    (authorizedMediaRequest as jest.Mock).mockReturnValue(new Promise(() => {}));
    (authorizedMediaText as jest.Mock).mockReturnValue(new Promise(() => {}));
  });

  it('shows the return details once loaded, including reasonDetails and no raw IDs', async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByText('RF-000042')).toBeTruthy());
    expect(screen.getByText('Market ABC')).toBeTruthy();
    expect(screen.getByText('Widget X200')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.getByText('Customer changed their mind')).toBeTruthy();
    expect(screen.getByText('3 CTN')).toBeTruthy();
    expect(screen.getByText('Driver One')).toBeTruthy();
    expect(screen.queryByText('return-1')).toBeNull();
    expect(screen.queryByText('d1')).toBeNull();
  });

  it('shows a not-found message for an inaccessible return', async () => {
    (getReturn as jest.Mock).mockRejectedValue(
      Object.assign(Object.create(ApiError.prototype), { kind: 'http', status: 404, message: 'not found' }),
    );

    render(<ReturnDetailsScreen {...(buildProps('missing-id') as any)} />);

    await waitFor(() => expect(screen.getByText('This return could not be found.')).toBeTruthy());
  });

  it('renders the Photos section with the approved empty state when there are none', async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByText('Photos')).toBeTruthy());
    expect(screen.getByText('No photos yet.')).toBeTruthy();
  });

  it('displays safe photo metadata for uploaded photos, without any token or storage key', async () => {
    (authorizedMediaRequest as jest.Mock).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
    (getReturn as jest.Mock).mockResolvedValue({
      ...RECORD,
      photos: [
        { id: 'photo-1', contentType: 'image/jpeg', sizeBytes: 1000, position: 1, contentPath: '/api/v1/driver/returns/return-1/photos/photo-1/content', createdAt: '2026-08-03T00:00:00.000Z' },
        { id: 'photo-2', contentType: 'image/jpeg', sizeBytes: 2000, position: 2, contentPath: '/api/v1/driver/returns/return-1/photos/photo-2/content', createdAt: '2026-08-03T00:01:00.000Z' },
      ],
    });

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    // Each photo is now its real thumbnail; its identity lives in the
    // accessible name rather than in visible metadata text.
    await waitFor(() => expect(screen.getByTestId('photo-image-1')).toBeTruthy());
    expect(screen.getByLabelText('Photo 1')).toBeTruthy();
    expect(screen.getByLabelText('Photo 2')).toBeTruthy();
    // Fetched through the authenticated client, so the private path is never
    // rendered and never becomes a public image source.
    expect(authorizedMediaRequest).toHaveBeenCalledWith('/api/v1/driver/returns/return-1/photos/photo-1/content');
    expect(screen.getByTestId('photo-image-1').props.source.uri).not.toContain('/api/v1/');
    expect(screen.queryByText(/photo-1\/content/)).toBeNull();
    expect(screen.queryByText('photo-1')).toBeNull();
  });

  it('shows Add photos when the return has fewer than five photos', async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);
    const props = buildProps('return-1');

    render(<ReturnDetailsScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('add-photos-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('add-photos-button'));

    expect(props.navigation.navigate).toHaveBeenCalledWith('AddReturnPhotos', { returnId: 'return-1', origin: 'details' });
  });

  it('hides Add photos once the return already has five photos', async () => {
    (authorizedMediaRequest as jest.Mock).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
    (getReturn as jest.Mock).mockResolvedValue({
      ...RECORD,
      photos: Array.from({ length: 5 }, (_, i) => ({
        id: `photo-${i}`,
        contentType: 'image/jpeg',
        sizeBytes: 1000,
        position: i + 1,
        contentPath: `/api/v1/driver/returns/return-1/photos/photo-${i}/content`,
        createdAt: '2026-08-03T00:00:00.000Z',
      })),
    });

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByTestId('photo-image-5')).toBeTruthy());
    expect(screen.queryByTestId('add-photos-button')).toBeNull();
    // The compact plus tile disappears with it, so neither entry point can
    // exceed the limit.
    expect(screen.queryByTestId('add-photo-tile')).toBeNull();
  });

  it('shows Signature: Pending with a capture action when the return has no signature yet', async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);
    const props = buildProps('return-1');

    render(<ReturnDetailsScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('signature-status')).toBeTruthy());

    expect(screen.getByTestId('signature-status').props.children).toBe('Pending');
    fireEvent.press(screen.getByTestId('capture-signature-button'));

    expect(props.navigation.navigate).toHaveBeenCalledWith('CustomerSignature', { returnId: 'return-1' });
  });

  it('shows Signature: Captured with the signer name and no capture action once signed', async () => {
    (getReturn as jest.Mock).mockResolvedValue({
      ...RECORD,
      signature: { id: 'sig-1', signerName: 'Jane Doe', contentType: 'image/svg+xml', sizeBytes: 500, contentPath: '/x', signedAt: '2026-08-03T00:02:00.000Z' },
    });

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByTestId('signature-status')).toBeTruthy());
    expect(screen.getByTestId('signature-status').props.children).toBe('Captured');
    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.queryByTestId('capture-signature-button')).toBeNull();
  });

  it('titles the screen and shows the real reference and status, never a fixed sample', async () => {
    (getReturn as jest.Mock).mockResolvedValue({ ...RECORD, status: 'IN_REVIEW' as const });

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByRole('header', { name: 'Return Details' })).toBeTruthy());
    expect(screen.getByText('RF-000042')).toBeTruthy();
    // The canonical status contract, not a hardcoded label.
    expect(screen.getByText('In review')).toBeTruthy();
    for (const sample of ['RF-000012', 'Awaiting warehouse']) {
      expect(screen.queryByText(sample)).toBeNull();
    }
  });

  it('presents the guided-flow arrival as Step 4, with the first three steps completed', async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);

    render(<ReturnDetailsScreen {...(buildProps('return-1', 'created') as any)} />);

    await waitFor(() => expect(screen.getByTestId('step-indicator')).toBeTruthy());
    expect(screen.getByLabelText('Step 1 of 4, Details, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 2 of 4, Photos, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 4, Signature, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 4 of 4, Review, current')).toBeTruthy();
    expect(screen.getByTestId('step-4').props.accessibilityState.selected).toBe(true);
  });

  it('shows no step indicator when an existing return is opened from My Returns', async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByText('RF-000042')).toBeTruthy());
    // An inspection, not a wizard step.
    expect(screen.queryByTestId('step-indicator')).toBeNull();
    expect(screen.queryByTestId('step-4')).toBeNull();
  });

  it('reuses the shared bottom navigation with Returns active', async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);
    const props = buildProps('return-1');

    render(<ReturnDetailsScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('bottom-nav-returns')).toBeTruthy());

    expect(screen.getByTestId('bottom-nav-returns').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('bottom-nav-profile').props.accessibilityState.selected).toBe(false);
    // One shared implementation, not a second copy.
    expect(screen.getAllByTestId('bottom-nav-new-return')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('bottom-nav-profile'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('Profile');
  });

  it('renders the captured signature through the authenticated media path', async () => {
    (authorizedMediaText as jest.Mock).mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    (getReturn as jest.Mock).mockResolvedValue({ ...RECORD, signature: { id: 'sig-1', signerName: 'Jane Doe', contentType: 'image/svg+xml', sizeBytes: 500, contentPath: '/api/v1/driver/returns/return-1/signature/content', signedAt: '2026-08-03T00:02:00.000Z' } });

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByTestId('signature-image')).toBeTruthy());
    expect(authorizedMediaText).toHaveBeenCalledWith('/api/v1/driver/returns/return-1/signature/content');
    expect(screen.getByText('Jane Doe')).toBeTruthy();
    // The real signed-at value, formatted by the existing shared formatter.
    expect(screen.getByText(formatDateTime('2026-08-03T00:02:00.000Z'))).toBeTruthy();
  });

  it('stays usable when the signature media cannot be loaded', async () => {
    (authorizedMediaText as jest.Mock).mockRejectedValue(new Error('media offline'));
    (getReturn as jest.Mock).mockResolvedValue({ ...RECORD, signature: { id: 'sig-1', signerName: 'Jane Doe', contentType: 'image/svg+xml', sizeBytes: 500, contentPath: '/api/v1/driver/returns/return-1/signature/content', signedAt: '2026-08-03T00:02:00.000Z' } });

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByTestId('signature-image-failed')).toBeTruthy());
    // The rest of the signature section still reads correctly.
    expect(screen.getByTestId('signature-status').props.children).toBe('Captured');
    expect(screen.getByText('Jane Doe')).toBeTruthy();
  });

  it('goes back without creating a return or submitting a signature', async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);
    const props = buildProps('return-1');

    render(<ReturnDetailsScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('return-details-back-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('return-details-back-button'));

    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
    // Return Details only reads; it never re-runs the creation workflow.
    expect(props.navigation.navigate).not.toHaveBeenCalledWith('CustomerSignature', expect.anything());
  });
});
