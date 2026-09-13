import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createReturn } from '../returns/returnService';
import CreateReturnScreen from './CreateReturnScreen';

jest.mock('../returns/returnService');

function buildNavigation() {
  return { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
}

/**
 * Reason and Unit now open their options in a sheet instead of rendering the
 * whole list inline, so choosing one is "open, then pick". The option rows
 * themselves keep their original testIDs and radio semantics.
 */
function chooseReason(value: string) {
  fireEvent.press(screen.getByTestId('reason-select'));
  fireEvent.press(screen.getByTestId(`reason-option-${value}`));
}

function chooseUnit(value: string) {
  fireEvent.press(screen.getByTestId('unit-select'));
  fireEvent.press(screen.getByTestId(`unit-option-${value}`));
}

describe('CreateReturnScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reveals Reason details only when Other is selected', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    expect(screen.queryByTestId('reason-details-input')).toBeNull();

    chooseReason('OTHER');

    expect(screen.getByTestId('reason-details-input')).toBeTruthy();
  });

  it('clears reasonDetails when the driver changes away from Other', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    chooseReason('OTHER');
    fireEvent.changeText(screen.getByTestId('reason-details-input'), 'Customer changed their mind');
    expect(screen.getByTestId('reason-details-input').props.value).toBe('Customer changed their mind');

    chooseReason('DAMAGED');
    expect(screen.queryByTestId('reason-details-input')).toBeNull();

    // Selecting OTHER again must show a cleared field, not the previous text.
    chooseReason('OTHER');
    expect(screen.getByTestId('reason-details-input').props.value).toBe('');
  });

  it('submits the exact backend payload and navigates to Add Photos on success', async () => {
    (createReturn as jest.Mock).mockResolvedValue({ id: 'return-123' });
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    fireEvent.changeText(screen.getByTestId('customer-name-input'), 'Market ABC');
    fireEvent.changeText(screen.getByTestId('product-name-input'), 'Widget X200');
    chooseReason('DAMAGED');
    fireEvent.changeText(screen.getByTestId('quantity-input'), '3');
    chooseUnit('CTN');
    fireEvent.changeText(screen.getByTestId('observation-input'), 'Box was open');

    fireEvent.press(screen.getByTestId('create-return-submit-button'));

    await waitFor(() =>
      expect(createReturn).toHaveBeenCalledWith({
        customerName: 'Market ABC',
        productName: 'Widget X200',
        reason: 'DAMAGED',
        quantity: 3,
        unit: 'CTN',
        observation: 'Box was open',
      }),
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('AddReturnPhotos', { returnId: 'return-123', origin: 'created' }),
    );
  });

  it('prevents a duplicate submission while the first one is still in flight', async () => {
    let resolveCreate: (value: { id: string }) => void = () => {};
    (createReturn as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    fireEvent.changeText(screen.getByTestId('customer-name-input'), 'Market ABC');
    fireEvent.changeText(screen.getByTestId('product-name-input'), 'Widget X200');
    chooseReason('DAMAGED');
    fireEvent.changeText(screen.getByTestId('quantity-input'), '3');
    chooseUnit('CTN');
    fireEvent.changeText(screen.getByTestId('observation-input'), 'Box was open');

    fireEvent.press(screen.getByTestId('create-return-submit-button'));
    fireEvent.press(screen.getByTestId('create-return-submit-button'));
    fireEvent.press(screen.getByTestId('create-return-submit-button'));

    resolveCreate({ id: 'return-123' });
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('AddReturnPhotos', { returnId: 'return-123', origin: 'created' }),
    );
    expect(createReturn).toHaveBeenCalledTimes(1);
  });

  it('shows a safe error message when the API call fails, without navigating away', async () => {
    (createReturn as jest.Mock).mockRejectedValue(new Error('raw backend detail that must never be shown'));
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    fireEvent.changeText(screen.getByTestId('customer-name-input'), 'Market ABC');
    fireEvent.changeText(screen.getByTestId('product-name-input'), 'Widget X200');
    chooseReason('DAMAGED');
    fireEvent.changeText(screen.getByTestId('quantity-input'), '3');
    chooseUnit('CTN');
    fireEvent.changeText(screen.getByTestId('observation-input'), 'Box was open');

    fireEvent.press(screen.getByTestId('create-return-submit-button'));

    await waitFor(() =>
      expect(screen.getByText('Unable to create the return. Please review the information and try again.')).toBeTruthy(),
    );
    expect(screen.queryByText(/raw backend detail/)).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('blocks submission and shows validation errors when required fields are missing', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    fireEvent.press(screen.getByTestId('create-return-submit-button'));

    expect(screen.getByText('Customer name is required.')).toBeTruthy();
    expect(createReturn).not.toHaveBeenCalled();
  });

  it('frames the screen as step 1 of the guided flow, with all four steps named', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    expect(screen.getByRole('header', { name: 'New Return' })).toBeTruthy();
    expect(screen.getByTestId('step-indicator')).toBeTruthy();

    for (const label of ['Details', 'Photos', 'Signature', 'Review']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    // Details is current; nothing else is.
    expect(screen.getByTestId('step-1').props.accessibilityState.selected).toBe(true);
    for (const position of [2, 3, 4]) {
      expect(screen.getByTestId(`step-${position}`).props.accessibilityState.selected).toBe(false);
    }
    expect(screen.getByLabelText('Step 1 of 4, Details, current')).toBeTruthy();
  });

  it('keeps every reason and both units available through the compact selectors', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    // Collapsed by default — the eleven reasons do not dominate the form.
    expect(screen.queryByTestId('reason-option-DAMAGED')).toBeNull();

    fireEvent.press(screen.getByTestId('reason-select'));
    for (const value of [
      'WRONG_ITEM_DELIVERED', 'EXTRA_ITEM', 'MISSING_ITEM', 'CUSTOMER_CHARGE_REQUIRED',
      'NO_LONGER_REQUIRED', 'WRONG_ITEM_ORDERED', 'EXCHANGE_REQUIRED', 'DAMAGED',
      'LEAKING', 'NOT_ORDERED', 'OTHER',
    ]) {
      expect(screen.getByTestId(`reason-option-${value}`)).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId('reason-option-DAMAGED'));

    fireEvent.press(screen.getByTestId('unit-select'));
    expect(screen.getByTestId('unit-option-CTN')).toBeTruthy();
    expect(screen.getByTestId('unit-option-EA')).toBeTruthy();
    // Only the two supported units.
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('goes back without creating anything', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    fireEvent.press(screen.getByTestId('create-return-back-button'));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(createReturn).not.toHaveBeenCalled();
  });

  it('renders a Product name field and blocks submission with a clear error when it is left blank', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    expect(screen.getByTestId('product-name-input')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('customer-name-input'), 'Market ABC');
    fireEvent.press(screen.getByTestId('create-return-submit-button'));

    expect(screen.getByText('Product name is required.')).toBeTruthy();
    expect(createReturn).not.toHaveBeenCalled();
  });
});
