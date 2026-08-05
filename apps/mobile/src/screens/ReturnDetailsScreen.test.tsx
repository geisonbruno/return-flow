import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ApiError } from '../api/problemDetails';
import { getReturn } from '../returns/returnService';
import ReturnDetailsScreen from './ReturnDetailsScreen';

jest.mock('../returns/returnService');

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

function buildProps(returnId: string) {
  return {
    navigation: { navigate: jest.fn() },
    route: { params: { returnId } },
  };
}

describe('ReturnDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    (getReturn as jest.Mock).mockResolvedValue({
      ...RECORD,
      photos: [
        { id: 'photo-1', contentType: 'image/jpeg', sizeBytes: 1000, position: 1, contentPath: '/api/v1/driver/returns/return-1/photos/photo-1/content', createdAt: '2026-08-03T00:00:00.000Z' },
        { id: 'photo-2', contentType: 'image/jpeg', sizeBytes: 2000, position: 2, contentPath: '/api/v1/driver/returns/return-1/photos/photo-2/content', createdAt: '2026-08-03T00:01:00.000Z' },
      ],
    });

    render(<ReturnDetailsScreen {...(buildProps('return-1') as any)} />);

    await waitFor(() => expect(screen.getByText('Photo 1')).toBeTruthy());
    expect(screen.getByText('Photo 2')).toBeTruthy();
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

    await waitFor(() => expect(screen.getByText('Photo 5')).toBeTruthy());
    expect(screen.queryByTestId('add-photos-button')).toBeNull();
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
});
