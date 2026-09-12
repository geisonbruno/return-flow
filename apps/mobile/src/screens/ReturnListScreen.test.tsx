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

/** A realistic `ReturnRecord`; each test overrides only what it asserts on. */
function buildReturn(overrides: Record<string, unknown>) {
  return {
    id: '1',
    returnNumber: 'RF-000001',
    customerName: 'Acme Pty Ltd',
    productName: 'Widget X200',
    reason: 'DAMAGED',
    reasonDetails: null,
    quantity: 1,
    unit: 'EA',
    observation: 'obs',
    status: 'AWAITING_WAREHOUSE',
    driver: { id: 'd1', fullName: 'Driver One' },
    route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
    photos: [],
    signature: null,
    createdAt: '2026-08-02T01:00:00.000Z',
    updatedAt: '2026-08-02T01:00:00.000Z',
    ...overrides,
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

    // This is the first render in the file, so it pays a one-time
    // native-mock/module initialization cost (SafeAreaView, FlatList,
    // RefreshControl) that the later tests below never pay again — that cost
    // occasionally exceeds testing-library's default 1000ms waitFor window
    // on a loaded machine even though the screen's loading-to-ready
    // transition itself is correct and fast. A longer timeout here is the
    // correct remedy for a slow first mount, not a synchronization bug.
    await waitFor(() => expect(screen.getByText('No returns yet.')).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText('Create your first return to get started.')).toBeTruthy();
    expect(screen.queryByText('Unable to load your returns.')).toBeNull();
  });

  it('shows the returned records in the given (newest-first) order without re-sorting them', async () => {
    (listReturns as jest.Mock).mockResolvedValue([
      {
        id: '2',
        returnNumber: 'RF-000002',
        customerName: 'Newer Customer',
        productName: 'Widget X200',
        reason: 'DAMAGED',
        reasonDetails: null,
        quantity: 1,
        unit: 'EA',
        observation: 'obs',
        status: 'AWAITING_WAREHOUSE',
        driver: { id: 'd1', fullName: 'Driver One' },
        route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
        photos: [
          { id: 'p1', contentType: 'image/jpeg', sizeBytes: 1, position: 1, contentPath: '/x', createdAt: '' },
          { id: 'p2', contentType: 'image/jpeg', sizeBytes: 1, position: 2, contentPath: '/x', createdAt: '' },
          { id: 'p3', contentType: 'image/jpeg', sizeBytes: 1, position: 3, contentPath: '/x', createdAt: '' },
        ],
        createdAt: '2026-08-02T01:00:00.000Z',
        updatedAt: '2026-08-02T01:00:00.000Z',
      },
      {
        id: '1',
        returnNumber: 'RF-000001',
        customerName: 'Older Customer',
        productName: 'Gadget Y300',
        reason: 'OTHER',
        reasonDetails: 'Some detail',
        quantity: 2,
        unit: 'CTN',
        observation: 'obs',
        status: 'AWAITING_WAREHOUSE',
        driver: { id: 'd1', fullName: 'Driver One' },
        route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
        photos: [],
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
    expect(screen.getByText('Widget X200')).toBeTruthy();
    expect(screen.getByText('Gadget Y300')).toBeTruthy();
    expect(screen.queryByText('obs')).toBeNull();
    expect(screen.getByText('Photos: 3')).toBeTruthy();
    expect(screen.getByText('Photos: 0')).toBeTruthy();
  });

  it('shows a Signature indicator distinguishing captured from pending returns', async () => {
    (listReturns as jest.Mock).mockResolvedValue([
      {
        id: '2',
        returnNumber: 'RF-000002',
        customerName: 'Signed Customer',
        productName: 'Widget X200',
        reason: 'DAMAGED',
        reasonDetails: null,
        quantity: 1,
        unit: 'EA',
        observation: 'obs',
        status: 'AWAITING_WAREHOUSE',
        driver: { id: 'd1', fullName: 'Driver One' },
        route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
        photos: [],
        signature: { id: 'sig-1', signerName: 'Jane Doe', contentType: 'image/svg+xml', sizeBytes: 500, contentPath: '/x', signedAt: '' },
        createdAt: '2026-08-02T01:00:00.000Z',
        updatedAt: '2026-08-02T01:00:00.000Z',
      },
      {
        id: '1',
        returnNumber: 'RF-000001',
        customerName: 'Unsigned Customer',
        productName: 'Gadget Y300',
        reason: 'OTHER',
        reasonDetails: 'Some detail',
        quantity: 2,
        unit: 'CTN',
        observation: 'obs',
        status: 'AWAITING_WAREHOUSE',
        driver: { id: 'd1', fullName: 'Driver One' },
        route: { id: 'r1', code: 'R1', name: 'Route One', active: true },
        photos: [],
        signature: null,
        createdAt: '2026-08-01T01:00:00.000Z',
        updatedAt: '2026-08-01T01:00:00.000Z',
      },
    ]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('Signature: Captured')).toBeTruthy());
    expect(screen.getByText('Signature: Pending')).toBeTruthy();
  });

  it('shows an error state with Retry, and Retry reloads the list', async () => {
    (listReturns as jest.Mock).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('Unable to load your returns.')).toBeTruthy());

    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByText('No returns yet.')).toBeTruthy());
  });

  it('uses the approved heading and drops the top New Return button and Log out', async () => {
    (listReturns as jest.Mock).mockResolvedValue([]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('My returns')).toBeTruthy());
    // The duplicate top call-to-action was removed on purpose: the bottom
    // navigation is the single New Return entry point on this screen.
    expect(screen.queryByTestId('new-return-button')).toBeNull();
    expect(screen.queryByText('+ New Return')).toBeNull();
    // Logout moved to Profile.
    expect(screen.queryByTestId('logout-button')).toBeNull();
    expect(screen.queryByText('Log out')).toBeNull();
  });

  it('offers exactly one visible New Return action, the bottom-navigation item', async () => {
    (listReturns as jest.Mock).mockResolvedValue([]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('My returns')).toBeTruthy());
    expect(screen.getAllByText('New Return')).toHaveLength(1);
    expect(screen.getAllByLabelText('New Return')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('bottom-nav-new-return'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateReturn');
  });

  it('keeps the empty state usable with no top call-to-action', async () => {
    (listReturns as jest.Mock).mockResolvedValue([]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('No returns yet.')).toBeTruthy());
    expect(screen.getByText('Create your first return to get started.')).toBeTruthy();
    // The persistent bottom-nav action is how a first return gets created.
    expect(screen.getByTestId('bottom-nav-new-return')).toBeTruthy();
  });

  it('renders the real photo count and signature state from each record', async () => {
    (listReturns as jest.Mock).mockResolvedValue([
      buildReturn({
        id: 'signed',
        returnNumber: 'RF-000100',
        photos: [{ id: 'p1', contentType: 'image/jpeg', sizeBytes: 1, position: 1, contentPath: '/x', createdAt: '' }],
        signature: { id: 's1', signerName: 'Jane', contentType: 'image/svg+xml', sizeBytes: 1, contentPath: '/x', signedAt: '' },
      }),
      buildReturn({ id: 'unsigned', returnNumber: 'RF-000101', photos: [], signature: null }),
    ]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('Photos: 1')).toBeTruthy());
    expect(screen.getByText('Photos: 0')).toBeTruthy();
    expect(screen.getByText('Captured')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  // Regression: the badge map once covered only AWAITING_WAREHOUSE, so a real
  // IN_REVIEW/CLOSED/CANCELLED record made the lookup return undefined and the
  // whole list crashed on `badge.color`. The fixtures never rendered those
  // statuses, so nothing caught it until the screen hit real API data.
  it('renders every lifecycle status without crashing, each with its own label', async () => {
    (listReturns as jest.Mock).mockResolvedValue([
      buildReturn({ id: 'a', returnNumber: 'RF-000001', status: 'AWAITING_WAREHOUSE' }),
      buildReturn({ id: 'b', returnNumber: 'RF-000002', status: 'IN_REVIEW' }),
      buildReturn({ id: 'c', returnNumber: 'RF-000003', status: 'CLOSED' }),
      buildReturn({ id: 'd', returnNumber: 'RF-000004', status: 'CANCELLED' }),
    ]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('Awaiting warehouse')).toBeTruthy());
    expect(screen.getByText('In review')).toBeTruthy();
    expect(screen.getByText('Closed')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();

    // Every card still rendered, and every card still opens Return Details.
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(screen.getByTestId(`return-card-${id}`)).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId('return-card-c'));
    expect(navigation.navigate).toHaveBeenCalledWith('ReturnDetails', { returnId: 'c' });
  });

  it('never blanks the screen on a status outside the compiled contract, and still shows text', async () => {
    // A status the backend could add before this client is rebuilt.
    (listReturns as jest.Mock).mockResolvedValue([
      buildReturn({ id: 'future', returnNumber: 'RF-000999', status: 'SOME_FUTURE_STATUS' }),
    ]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByTestId('return-card-future')).toBeTruthy());
    // Readable text rather than an empty badge or a white screen.
    expect(screen.getByText('SOME_FUTURE_STATUS')).toBeTruthy();
    expect(screen.getByText('RF-000999')).toBeTruthy();
  });

  it('keeps the real status label from the record rather than a hardcoded one', async () => {
    (listReturns as jest.Mock).mockResolvedValue([buildReturn({ id: '1', returnNumber: 'RF-000001' })]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    // STATUS_LABELS['AWAITING_WAREHOUSE'] — read from the record's own status.
    await waitFor(() => expect(screen.getByText('Awaiting warehouse')).toBeTruthy());
  });

  it('opens Return Details for the card that was tapped, with that return id', async () => {
    (listReturns as jest.Mock).mockResolvedValue([
      buildReturn({ id: 'abc-123', returnNumber: 'RF-000009' }),
      buildReturn({ id: 'def-456', returnNumber: 'RF-000010' }),
    ]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByTestId('return-card-def-456')).toBeTruthy());
    fireEvent.press(screen.getByTestId('return-card-def-456'));

    expect(navigation.navigate).toHaveBeenCalledWith('ReturnDetails', { returnId: 'def-456' });
  });

  it('shows the shared bottom navigation with Returns selected, and its New Return item reaches CreateReturn', async () => {
    (listReturns as jest.Mock).mockResolvedValue([]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByTestId('bottom-nav-returns')).toBeTruthy());
    expect(screen.getByTestId('bottom-nav-returns').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('bottom-nav-profile').props.accessibilityState.selected).toBe(false);

    fireEvent.press(screen.getByTestId('bottom-nav-new-return'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateReturn');

    fireEvent.press(screen.getByTestId('bottom-nav-profile'));
    expect(navigation.navigate).toHaveBeenCalledWith('Profile');
  });

  it('still reloads the list on focus, so a newly created return appears', async () => {
    (listReturns as jest.Mock).mockResolvedValue([]);
    const navigation = buildNavigation();

    render(<ReturnListScreen navigation={navigation as any} route={{} as any} />);

    await waitFor(() => expect(screen.getByText('No returns yet.')).toBeTruthy());
    expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(listReturns).toHaveBeenCalledTimes(1);
  });
});
