import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useAuth } from '../auth/AuthContext';
import { listReturns } from '../returns/returnService';
import ReturnListScreen from './ReturnListScreen';

jest.mock('../returns/returnService');
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;

function buildNavigation() {
  return {
    addListener: jest.fn((event: string, callback: () => void) => {
      if (event === 'focus') {
        callback();
      }
      return jest.fn();
    }),
    navigate: jest.fn(),
  };
}

describe('ReturnListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ logout: jest.fn() });
  });

  it('shows the empty state when the driver has no returns', async () => {
    (listReturns as jest.Mock).mockResolvedValue([]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('No returns yet.')).toBeTruthy());
    expect(screen.getByText('Create your first return to get started.')).toBeTruthy();
  });

  it('shows the returned records in the given (newest-first) order without re-sorting them', async () => {
    (listReturns as jest.Mock).mockResolvedValue([
      {
        id: '2',
        returnNumber: 'RF-000002',
        customerName: 'Newer Customer',
        reason: 'DAMAGED',
        reasonDetails: null,
        quantity: 1,
        unit: 'EA',
        observation: 'obs',
        status: 'AWAITING_WAREHOUSE',
        driver: { id: 'd1', fullName: 'Driver One' },
        route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
        createdAt: '2026-08-02T01:00:00.000Z',
        updatedAt: '2026-08-02T01:00:00.000Z',
      },
      {
        id: '1',
        returnNumber: 'RF-000001',
        customerName: 'Older Customer',
        reason: 'OTHER',
        reasonDetails: 'Some detail',
        quantity: 2,
        unit: 'CTN',
        observation: 'obs',
        status: 'AWAITING_WAREHOUSE',
        driver: { id: 'd1', fullName: 'Driver One' },
        route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
        createdAt: '2026-08-01T01:00:00.000Z',
        updatedAt: '2026-08-01T01:00:00.000Z',
      },
    ]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('RF-000002')).toBeTruthy());
    expect(screen.getByText('RF-000001')).toBeTruthy();
    expect(screen.getByText('1 EA')).toBeTruthy();
    expect(screen.getByText('2 CTN')).toBeTruthy();
  });

  it('shows an error state with Retry, and Retry reloads the list', async () => {
    (listReturns as jest.Mock).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('Unable to load your returns.')).toBeTruthy());

    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByText('No returns yet.')).toBeTruthy());
  });
});
