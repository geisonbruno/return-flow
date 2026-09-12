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
  // The first render in this file pays a one-time cost to initialise
  // `react-native-svg`, which draws the brand mark and the field icons. On a
  // cold jest cache that alone exceeded the 5s default timeout, so it is paid
  // here rather than inside whichever test happens to run first.
  beforeAll(() => {
    mockedUseAuth.mockReturnValue({ login: jest.fn(), sessionMessage: null });
    render(<LoginScreen />).unmount();
  }, 60000);

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

  it('renders the redesigned driver sign-in copy and brand wordmark', () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn(), sessionMessage: null });

    render(<LoginScreen />);

    expect(screen.getByText('ReturnFlow')).toBeTruthy();
    expect(screen.getByText('Driver sign in')).toBeTruthy();
    expect(screen.getByText('Sign in to your account to manage returns on the go.')).toBeTruthy();
  });

  it('hides the password by default and offers a Show password control', () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn(), sessionMessage: null });

    render(<LoginScreen />);

    expect(screen.getByTestId('login-password-input').props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText('Show password')).toBeTruthy();
    expect(screen.queryByLabelText('Hide password')).toBeNull();
  });

  it('reveals and re-hides the password, preserving the typed value and never submitting', () => {
    const login = jest.fn();
    mockedUseAuth.mockReturnValue({ login, sessionMessage: null });

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'password123');

    fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByTestId('login-password-input').props.secureTextEntry).toBe(false);
    expect(screen.getByTestId('login-password-input').props.value).toBe('password123');
    expect(screen.getByLabelText('Hide password')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByTestId('login-password-input').props.secureTextEntry).toBe(true);
    expect(screen.getByTestId('login-password-input').props.value).toBe('password123');

    // The reveal control is not a submit control.
    expect(login).not.toHaveBeenCalled();
  });

  it('submits exactly the credentials that were typed, including a revealed password', async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ login, sessionMessage: null });

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-email-input'), 'driver@example.com');
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'password123');
    fireEvent.press(screen.getByLabelText('Show password'));
    fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => expect(login).toHaveBeenCalledWith('driver@example.com', 'password123'));
  });
});
