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
    navigation: { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() },
    route: { params: { returnId } },
  };
}

describe('CustomerSignatureScreen', () => {
  // The first render in this file pays a one-time cost to initialise the
  // module tree (the signature pad's SVG layer and the step indicator among
  // them). On a cold jest cache — the condition CI starts in — that alone
  // outlasted the default waitFor window, so it is paid here rather than
  // inside whichever test happens to run first.
  beforeAll(async () => {
    (getReturn as jest.Mock).mockResolvedValue(RECORD);
    const view = render(<CustomerSignatureScreen {...(buildProps() as any)} />);
    // The generous window is the point: this is the cold-start cost itself.
    await waitFor(() => expect(screen.getByTestId('signer-name-input')).toBeTruthy(), { timeout: 30000 });
    view.unmount();
  }, 60000);

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

    await waitFor(() => expect(props.navigation.replace).toHaveBeenCalledWith('ReturnDetails', { returnId: 'return-1', origin: 'created' }));
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

    expect(props.navigation.replace).toHaveBeenCalledWith('ReturnDetails', { returnId: 'return-1', origin: 'created' });
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

  it('frames the screen as step 3, with Details and Photos already completed', async () => {
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('signer-name-input')).toBeTruthy());

    expect(screen.getByRole('header', { name: 'Customer Signature' })).toBeTruthy();
    expect(screen.getByTestId('step-indicator')).toBeTruthy();
    for (const label of ['Details', 'Photos', 'Signature', 'Review']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    expect(screen.getByLabelText('Step 1 of 4, Details, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 2 of 4, Photos, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 4, Signature, current')).toBeTruthy();
    expect(screen.getByLabelText('Step 4 of 4, Review, upcoming')).toBeTruthy();

    expect(screen.getByTestId('step-3').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('step-2').props.accessibilityState.selected).toBe(false);
  });

  it('builds the summary from the loaded return, never from fixed sample values', async () => {
    (getReturn as jest.Mock).mockResolvedValue({
      ...RECORD,
      returnNumber: 'RF-000777',
      customerName: 'Corner Store',
      productName: 'Milk 2L',
      quantity: 1,
      unit: 'EA' as const,
      reason: 'MISSING_ITEM' as const,
    });
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);

    await waitFor(() => expect(screen.getByText('RF-000777')).toBeTruthy());
    expect(screen.getByText('Corner Store')).toBeTruthy();
    expect(screen.getByText('Milk 2L')).toBeTruthy();
    // Canonical quantity + unit, and the reason label rather than the enum.
    expect(screen.getByText('1 EA')).toBeTruthy();
    expect(screen.getByText('Missing item')).toBeTruthy();
    expect(screen.queryByText('MISSING_ITEM')).toBeNull();

    // None of the screenshot's sample values leak into the screen.
    for (const sample of ['RF-000012', 'Customer X', 'Milk blue 2l']) {
      expect(screen.queryByText(sample)).toBeNull();
    }
  });

  it('keeps Undo and Clear wired to the existing pad handle', async () => {
    render(<CustomerSignatureScreen {...(buildProps() as any)} />);
    await waitFor(() => expect(screen.getByTestId('undo-button')).toBeTruthy());

    // Both remain reachable by name, not by icon alone.
    expect(screen.getByLabelText('Undo')).toBeTruthy();
    expect(screen.getByLabelText('Clear')).toBeTruthy();

    // Clear resets the drawn signature, so submitting afterwards is blocked
    // again by the existing validation rather than sending empty strokes.
    fireEvent.press(screen.getByTestId('signature-pad'));
    fireEvent.changeText(screen.getByTestId('signer-name-input'), 'Jane Customer');
    fireEvent.press(screen.getByTestId('clear-button'));
    fireEvent.press(screen.getByTestId('submit-signature-button'));

    await waitFor(() => expect(screen.getByText('Please draw the customer signature before submitting.')).toBeTruthy());
    expect(createReturnSignature).not.toHaveBeenCalled();
  });

  it('goes back without creating, signing or mutating the return', async () => {
    const props = buildProps('return-42');
    render(<CustomerSignatureScreen {...(props as any)} />);
    await waitFor(() => expect(screen.getByTestId('signature-back-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('signature-back-button'));

    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
    expect(createReturnSignature).not.toHaveBeenCalled();
    expect(props.navigation.replace).not.toHaveBeenCalled();
  });
});
