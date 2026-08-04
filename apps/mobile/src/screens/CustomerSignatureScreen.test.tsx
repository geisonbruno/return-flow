import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createReturnSignature, getReturn } from '../returns/returnService';
import CustomerSignatureScreen from './CustomerSignatureScreen';

jest.mock('../returns/returnService', () => ({
  getReturn: jest.fn(),
  createReturnSignature: jest.fn(),
}));

// SignaturePad's real gesture handling is exercised separately in its own
// test file — here it's replaced with a minimal stand-in exposing a single
// button that reports a fixed, valid set of strokes, so this screen's own
// logic (validation wiring, submit flow, captured-state handling) can be
// tested without re-simulating PanResponder gestures.
jest.mock('../components/SignaturePad', () => {
  const RN = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: ReactActual.forwardRef((props: { onStrokesChange: (strokes: unknown) => void }, ref: unknown) => {
      ReactActual.useImperativeHandle(ref, () => ({ clear: jest.fn(), undoLast: jest.fn() }));
      return ReactActual.createElement(RN.Pressable, {
        testID: 'signature-pad',
        accessibilityRole: 'button',
        onPress: () =>
          props.onStrokesChange([
            [{ x: 0.1, y: 0.5 }, { x: 0.2, y: 0.4 }, { x: 0.35, y: 0.55 }, { x: 0.5, y: 0.35 }],
          ]),
      });
    }),
  };
});

const RECORD = {
  id: 'return-1',
  returnNumber: 'RF-000001',
  customerName: 'Market ABC',
  productName: 'Widget X200',
  reason: 'DAMAGED' as const,
  reasonDetails: null,
  quantity: 3,
  unit: 'CTN' as const,
  observation: 'Box was open',
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

describe('CustomerSignatureScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getReturn as jest.Mock).mockResolvedValue(RECORD);
  });

  it('renders the return summary', async () => {
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByText('RF-000001')).toBeTruthy());
    expect(screen.getByText('Market ABC')).toBeTruthy();
    expect(screen.getByText('Widget X200')).toBeTruthy();
  });

  it('renders the signer-name input and the signature pad', async () => {
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByTestId('signer-name-input')).toBeTruthy());
    expect(screen.getByTestId('signature-pad')).toBeTruthy();
  });

  it('rejects submission with a blank signer name and no drawn signature', async () => {
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('submit-signature-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('submit-signature-button'));

    expect(screen.getByText('Signer name is required.')).toBeTruthy();
    expect(screen.getByText('Please draw the customer signature before submitting.')).toBeTruthy();
    expect(createReturnSignature).not.toHaveBeenCalled();
  });

  it('rejects submission with a name but no drawn signature', async () => {
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('signer-name-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('signer-name-input'), 'John Smith');
    fireEvent.press(screen.getByTestId('submit-signature-button'));

    expect(screen.getByText('Please draw the customer signature before submitting.')).toBeTruthy();
    expect(createReturnSignature).not.toHaveBeenCalled();
  });

  it('submits exactly signerName and strokes, then navigates to Return Details', async () => {
    (createReturnSignature as jest.Mock).mockResolvedValue({ id: 'sig-1' });
    const props = buildProps('return-1');
    render(<CustomerSignatureScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('signer-name-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('signer-name-input'), '  John Smith  ');
    fireEvent.press(screen.getByTestId('signature-pad'));
    fireEvent.press(screen.getByTestId('submit-signature-button'));

    await waitFor(() => expect(createReturnSignature).toHaveBeenCalledTimes(1));
    const [returnId, payload] = (createReturnSignature as jest.Mock).mock.calls[0];
    expect(returnId).toBe('return-1');
    expect(payload.signerName).toBe('John Smith');
    expect(Object.keys(payload)).toEqual(['signerName', 'strokes']);

    await waitFor(() => expect(props.navigation.replace).toHaveBeenCalledWith('ReturnDetails', { returnId: 'return-1' }));
  });

  it('prevents a duplicate submission while the first one is still in flight', async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    (createReturnSignature as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const props = buildProps('return-1');
    render(<CustomerSignatureScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('signer-name-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('signer-name-input'), 'John Smith');
    fireEvent.press(screen.getByTestId('signature-pad'));
    fireEvent.press(screen.getByTestId('submit-signature-button'));
    fireEvent.press(screen.getByTestId('submit-signature-button'));
    fireEvent.press(screen.getByTestId('submit-signature-button'));

    resolveCreate({ id: 'sig-1' });
    await waitFor(() => expect(props.navigation.replace).toHaveBeenCalled());
    expect(createReturnSignature).toHaveBeenCalledTimes(1);
  });

  it('shows a safe error message when submission fails, without navigating away', async () => {
    (createReturnSignature as jest.Mock).mockRejectedValue(new Error('raw backend detail that must never be shown'));
    const props = buildProps('return-1');
    render(<CustomerSignatureScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('signer-name-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('signer-name-input'), 'John Smith');
    fireEvent.press(screen.getByTestId('signature-pad'));
    fireEvent.press(screen.getByTestId('submit-signature-button'));

    await waitFor(() => expect(screen.getByText('Unable to submit the signature. Please try again.')).toBeTruthy());
    expect(props.navigation.replace).not.toHaveBeenCalled();
  });

  it('does not allow another submission when the return already has a signature, and offers a safe path to Return Details', async () => {
    (getReturn as jest.Mock).mockResolvedValue({
      ...RECORD,
      signature: { id: 'sig-1', signerName: 'Jane Doe', contentType: 'image/svg+xml', sizeBytes: 500, contentPath: '/x', signedAt: '2026-08-01T10:05:00Z' },
    });
    const props = buildProps('return-1');
    render(<CustomerSignatureScreen {...(props as any)} />);

    await waitFor(() => expect(screen.getByTestId('go-to-details-button')).toBeTruthy());
    expect(screen.queryByTestId('submit-signature-button')).toBeNull();
    expect(screen.getByText(/Jane Doe/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('go-to-details-button'));

    expect(props.navigation.replace).toHaveBeenCalledWith('ReturnDetails', { returnId: 'return-1' });
    expect(createReturnSignature).not.toHaveBeenCalled();
  });

  it('shows a loading state while the return is being fetched', () => {
    (getReturn as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);

    expect(screen.getByText('Loading return…')).toBeTruthy();
  });

  it('shows a retryable error state when the return fails to load', async () => {
    (getReturn as jest.Mock).mockRejectedValue(new Error('network blip'));
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByText('Unable to load this return.')).toBeTruthy());
  });
});
