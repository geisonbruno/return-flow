import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useAuth } from '../auth/AuthContext';
import LoginScreen from './LoginScreen';

jest.mock('../auth/AuthContext', () => {
  const actual = jest.requireActual('../auth/AuthContext');
  return { ...actual, useAuth: jest.fn() };
});

const mockedUseAuth = useAuth as jest.Mock;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables the submit button while a login request is in progress and prevents a duplicate submission', async () => {
    let resolveLogin: () => void = () => {};
    const login = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    mockedUseAuth.mockReturnValue({ login, sessionMessage: null });

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-email-input'), 'driver@example.com');
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'password123');

    fireEvent.press(screen.getByTestId('login-submit-button'));
    fireEvent.press(screen.getByTestId('login-submit-button'));
    fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => expect(screen.getByTestId('login-submit-button').props.accessibilityState.disabled).toBe(true));
    expect(login).toHaveBeenCalledTimes(1);

    resolveLogin();
    await waitFor(() => expect(screen.getByTestId('login-submit-button').props.accessibilityState.disabled).toBe(false));
  });

  it('shows only a safe fallback message on login failure, never the raw error detail', async () => {
    const login = jest.fn().mockRejectedValue(new Error('some internal detail that must never reach the driver'));
    mockedUseAuth.mockReturnValue({ login, sessionMessage: null });

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-email-input'), 'driver@example.com');
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'wrong-password');
    fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => expect(screen.getByText('Unable to sign in. Check your email and password.')).toBeTruthy());
    expect(screen.queryByText(/internal detail/)).toBeNull();
  });

  it('displays a session message passed down from AuthContext (e.g. driver-only rejection)', () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn(), sessionMessage: 'This app is available to drivers only.' });

    render(<LoginScreen />);

    expect(screen.getByText('This app is available to drivers only.')).toBeTruthy();
  });
});
