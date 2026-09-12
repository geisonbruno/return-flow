import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useAuth } from '../auth/AuthContext';
import ProfileScreen from './ProfileScreen';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;

const DRIVER = {
  userId: 'user-1',
  fullName: 'Dana Driver',
  email: 'dana@warehouse.example',
  role: 'DRIVER',
  tenantId: 'tenant-1',
  tenantName: 'Warehouse',
};

function buildNavigation() {
  return { navigate: jest.fn() };
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the authenticated driver's name, email and role", () => {
    mockedUseAuth.mockReturnValue({ user: DRIVER, logout: jest.fn() });

    render(<ProfileScreen navigation={buildNavigation() as never} route={{} as never} />);

    expect(screen.getByText('Dana Driver')).toBeTruthy();
    expect(screen.getByText('dana@warehouse.example')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Driver')).toBeTruthy();
    // Initials, derived from the name already in the session — not an upload.
    expect(screen.getByText('DD')).toBeTruthy();
  });

  it('never invents a route assignment, and never shows technical identifiers', () => {
    mockedUseAuth.mockReturnValue({ user: DRIVER, logout: jest.fn() });

    render(<ProfileScreen navigation={buildNavigation() as never} route={{} as never} />);

    // The authenticated-user contract carries no route, so none is displayed.
    expect(screen.queryByText('Route')).toBeNull();
    expect(screen.queryByText(/Route/)).toBeNull();
    expect(screen.queryByText('user-1')).toBeNull();
    expect(screen.queryByText('tenant-1')).toBeNull();
  });

  it('omits the tenant/warehouse row, even though the session still carries the name', () => {
    // `tenantName` remains in `AuthContext` and in `/auth/me`; the MVP profile
    // simply does not present it, keeping the screen to identity, role and
    // sign-out.
    mockedUseAuth.mockReturnValue({ user: DRIVER, logout: jest.fn() });

    render(<ProfileScreen navigation={buildNavigation() as never} route={{} as never} />);

    expect(screen.queryByText('Warehouse')).toBeNull();
    expect(screen.queryByText(DRIVER.tenantName)).toBeNull();
  });

  it('shows exactly the approved minimal composition and nothing more', () => {
    mockedUseAuth.mockReturnValue({ user: DRIVER, logout: jest.fn() });

    render(<ProfileScreen navigation={buildNavigation() as never} route={{} as never} />);

    // Present: heading, initials, name, email, Account/Driver, Log out.
    // Targeted by role: "Profile" is also the bottom-navigation item's label.
    expect(screen.getByRole('header', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('DD')).toBeTruthy();
    expect(screen.getByText('Dana Driver')).toBeTruthy();
    expect(screen.getByText('dana@warehouse.example')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Driver')).toBeTruthy();
    expect(screen.getByLabelText('Log out')).toBeTruthy();

    // Absent: everything the MVP profile deliberately excludes.
    for (const absent of ['Edit profile', 'Change password', 'Settings', 'Notifications', 'Language', 'Theme', 'Delete account']) {
      expect(screen.queryByText(absent)).toBeNull();
    }
  });

  it('owns the logout action and delegates to the existing AuthContext logout', async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ user: DRIVER, logout });

    render(<ProfileScreen navigation={buildNavigation() as never} route={{} as never} />);

    fireEvent.press(screen.getByTestId('logout-button'));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    // No bespoke sign-out logic: the screen calls the one shared implementation.
    expect(logout).toHaveBeenCalledWith();
    // Let the in-flight state settle before the test ends. In the app the
    // screen unmounts here, because the auth status flips to unauthenticated.
    await waitFor(() => expect(screen.getByTestId('logout-button').props.accessibilityState.disabled).toBe(false));
  });

  it('does not sign out twice when the button is pressed repeatedly', async () => {
    let resolveLogout: () => void = () => {};
    const logout = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        }),
    );
    mockedUseAuth.mockReturnValue({ user: DRIVER, logout });

    render(<ProfileScreen navigation={buildNavigation() as never} route={{} as never} />);

    fireEvent.press(screen.getByTestId('logout-button'));
    fireEvent.press(screen.getByTestId('logout-button'));
    fireEvent.press(screen.getByTestId('logout-button'));

    await waitFor(() => expect(screen.getByTestId('logout-button').props.accessibilityState.disabled).toBe(true));
    expect(logout).toHaveBeenCalledTimes(1);

    resolveLogout();
    await waitFor(() => expect(screen.getByTestId('logout-button').props.accessibilityState.disabled).toBe(false));
  });

  it('shows the shared bottom navigation with Profile selected', () => {
    mockedUseAuth.mockReturnValue({ user: DRIVER, logout: jest.fn() });

    render(<ProfileScreen navigation={buildNavigation() as never} route={{} as never} />);

    expect(screen.getByTestId('bottom-nav-profile').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('bottom-nav-returns')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-new-return')).toBeTruthy();
  });
});
