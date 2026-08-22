import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getReturn } from '../returns/returnService';
import CustomerSignatureScreen from './CustomerSignatureScreen';

/**
 * Deliberately a separate file from `CustomerSignatureScreen.test.tsx`,
 * which replaces `SignaturePad` with a button-shaped stand-in: this suite
 * needs the **real** pad, because the behavior under test is the gesture
 * contention between the pad and the surrounding `ScrollView` that made
 * signing unusable on a physical iPhone (the page moved under the finger
 * that was drawing). A mocked pad cannot reproduce it.
 */
jest.mock('../returns/returnService', () => ({
  getReturn: jest.fn(),
  createReturnSignature: jest.fn(),
}));

// Same synthetic-touch shape SignaturePad's own tests use — PanResponder
// reads `touchHistory` off the top level of the event, and
// `mostRecentTimeStamp` must strictly increase or a move event is a no-op.
let nextTimeStamp = 1;

function touch(locationX: number, locationY: number) {
  return {
    nativeEvent: { locationX, locationY },
    touchHistory: { touchBank: [], numberActiveTouches: 0, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: nextTimeStamp++ },
  };
}

function layout(width = 300, height = 220) {
  return { nativeEvent: { layout: { x: 0, y: 0, width, height } } };
}

const RECORD = {
  id: 'return-1',
  returnNumber: 'RF-000001',
  customerName: 'Market ABC',
  productName: 'Widget X200',
  reason: 'DAMAGED' as const,
  reasonDetails: null,
  quantity: 3,
  unit: 'CTN' as const,
  observation: null,
  status: 'AWAITING_WAREHOUSE' as const,
  driver: { id: 'driver-1', fullName: 'Driver One' },
  route: { id: 'route-1', code: 'R1', name: 'Route One', active: true },
  photos: [],
  signature: null,
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-01T10:00:00Z',
};

function buildProps(returnId = 'return-1') {
  return {
    navigation: { replace: jest.fn(), navigate: jest.fn() },
    route: { params: { returnId } },
  };
}

function scrollEnabled(): boolean {
  return screen.getByTestId('signature-scroll').props.scrollEnabled;
}

async function renderReadyScreen() {
  render(<CustomerSignatureScreen {...(buildProps() as any)} />);
  await waitFor(() => expect(screen.getByTestId('signature-pad')).toBeTruthy());
  const pad = screen.getByTestId('signature-pad');
  fireEvent(pad, 'layout', layout());
  return pad;
}

describe('CustomerSignatureScreen — signature pad vs. page scrolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getReturn as jest.Mock).mockResolvedValue(RECORD);
  });

  it('leaves the page scrollable before any drawing starts', async () => {
    await renderReadyScreen();

    expect(scrollEnabled()).toBe(true);
  });

  it('stops the page scrolling while a finger is drawing inside the pad', async () => {
    const pad = await renderReadyScreen();

    fireEvent(pad, 'responderGrant', touch(20, 20));

    expect(scrollEnabled()).toBe(false);

    fireEvent(pad, 'responderMove', touch(120, 90));

    expect(scrollEnabled()).toBe(false);
  });

  it('restores page scrolling as soon as the finger is released', async () => {
    const pad = await renderReadyScreen();

    fireEvent(pad, 'responderGrant', touch(20, 20));
    fireEvent(pad, 'responderMove', touch(120, 90));
    fireEvent(pad, 'responderRelease', {});

    expect(scrollEnabled()).toBe(true);
  });

  it('restores page scrolling when the gesture is terminated rather than released', async () => {
    const pad = await renderReadyScreen();

    fireEvent(pad, 'responderGrant', touch(20, 20));
    fireEvent(pad, 'responderMove', touch(120, 90));
    fireEvent(pad, 'responderTerminate', {});

    expect(scrollEnabled()).toBe(true);
  });

  it('does not hand the gesture to the surrounding ScrollView while drawing', async () => {
    const pad = await renderReadyScreen();

    // The scrolling ancestor asks the active responder to release the
    // gesture the moment its own native scroll begins; the pad must refuse.
    expect(pad.props.onResponderTerminationRequest()).toBe(false);
  });

  it('reaches the screen through the real pad, so a drawn stroke still lands in the screen state', async () => {
    const pad = await renderReadyScreen();

    fireEvent(pad, 'responderGrant', touch(20, 20));
    fireEvent(pad, 'responderMove', touch(150, 120));
    fireEvent(pad, 'responderMove', touch(280, 40));
    fireEvent(pad, 'responderRelease', {});

    // A stroke that reached the screen clears any pending "please draw"
    // validation message — the only observable signal this screen exposes.
    fireEvent.press(screen.getByTestId('submit-signature-button'));

    await waitFor(() => expect(screen.getByText('Signer name is required.')).toBeTruthy());
    expect(screen.queryByText('Please draw the customer signature before submitting.')).toBeNull();
  });
});
