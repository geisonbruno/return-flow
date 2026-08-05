import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createReturn } from '../returns/returnService';
import CreateReturnScreen from './CreateReturnScreen';

jest.mock('../returns/returnService');

function buildNavigation() {
  return { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
}

describe('CreateReturnScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reveals Reason details only when Other is selected', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    expect(screen.queryByTestId('reason-details-input')).toBeNull();

    fireEvent.press(screen.getByTestId('reason-option-OTHER'));

    expect(screen.getByTestId('reason-details-input')).toBeTruthy();
  });

  it('clears reasonDetails when the driver changes away from Other', () => {
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    fireEvent.press(screen.getByTestId('reason-option-OTHER'));
    fireEvent.changeText(screen.getByTestId('reason-details-input'), 'Customer changed their mind');
    expect(screen.getByTestId('reason-details-input').props.value).toBe('Customer changed their mind');

    fireEvent.press(screen.getByTestId('reason-option-DAMAGED'));
    expect(screen.queryByTestId('reason-details-input')).toBeNull();

    // Selecting OTHER again must show a cleared field, not the previous text.
    fireEvent.press(screen.getByTestId('reason-option-OTHER'));
    expect(screen.getByTestId('reason-details-input').props.value).toBe('');
  });

  it('submits the exact backend payload and navigates to Add Photos on success', async () => {
    (createReturn as jest.Mock).mockResolvedValue({ id: 'return-123' });
    const navigation = buildNavigation();
    render(<CreateReturnScreen navigation={navigation as any} route={{} as any} />);

    fireEvent.changeText(screen.getByTestId('customer-name-input'), 'Market ABC');
    fireEvent.changeText(screen.getByTestId('product-name-input'), 'Widget X200');
    fireEvent.press(screen.getByTestId('reason-option-DAMAGED'));
    fireEvent.changeText(screen.getByTestId('quantity-input'), '3');
    fireEvent.press(screen.getByTestId('unit-option-CTN'));
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
    fireEvent.press(screen.getByTestId('reason-option-DAMAGED'));
    fireEvent.changeText(screen.getByTestId('quantity-input'), '3');
    fireEvent.press(screen.getByTestId('unit-option-CTN'));
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
    fireEvent.press(screen.getByTestId('reason-option-DAMAGED'));
    fireEvent.changeText(screen.getByTestId('quantity-input'), '3');
    fireEvent.press(screen.getByTestId('unit-option-CTN'));
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
