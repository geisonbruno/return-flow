import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ApiError } from '../api/problemDetails';
import { getReturn } from '../returns/returnService';
import ReturnDetailsScreen from './ReturnDetailsScreen';

jest.mock('../returns/returnService');

const RECORD = {
  id: 'return-1',
  returnNumber: 'RF-000042',
  customerName: 'Market ABC',
  reason: 'OTHER' as const,
  reasonDetails: 'Customer changed their mind',
  quantity: 3,
  unit: 'CTN' as const,
  observation: 'Box was open',
  status: 'AWAITING_WAREHOUSE' as const,
  driver: { id: 'd1', fullName: 'Driver One' },
  route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
  createdAt: '2026-08-02T01:15:00.000Z',
  updatedAt: '2026-08-02T01:15:00.000Z',
};

function buildProps(returnId: string) {
  return {
    navigation: {} as any,
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
});
