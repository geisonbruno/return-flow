import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

import { AuthProvider, useAuth } from './AuthContext';
import * as authService from './authService';

jest.mock('../config/environment', () => ({
  getApiBaseUrl: () => 'http://test-api.local',
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./authService');

const DRIVER_USER = {
  userId: 'u1',
  fullName: 'Driver One',
  email: 'driver@example.com',
  role: 'DRIVER' as const,
  tenantId: 't1',
  tenantName: 'Warehouse',
};

const ADMIN_USER = { ...DRIVER_USER, role: 'ADMIN' as const, fullName: 'Admin One' };

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (authService.logout as jest.Mock).mockResolvedValue(undefined);
  });

  it('settles to unauthenticated when no session is stored', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
  });

  it('restores a stored session for a driver', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
      key.includes('accessToken') ? 'stored-access' : 'stored-refresh',
    );
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(DRIVER_USER);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.fullName).toBe('Driver One');
  });

  it('successful login stores the returned tokens through SecureStore', async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      accessToken: 'a1',
      refreshToken: 'r1',
      accessTokenExpiresAt: '',
      tokenType: 'Bearer',
    });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(DRIVER_USER);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await result.current.login('driver@example.com', 'password123');
    });

    expect(result.current.status).toBe('authenticated');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.stringContaining('accessToken'), 'a1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.stringContaining('refreshToken'), 'r1');
  });

  it('rejects login for a non-driver and never persists a session for them', async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      accessToken: 'a1',
      refreshToken: 'r1',
      accessTokenExpiresAt: '',
      tokenType: 'Bearer',
    });
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(ADMIN_USER);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await expect(
      act(async () => {
        await result.current.login('admin@example.com', 'password123');
      }),
    ).rejects.toThrow('This app is available to drivers only.');

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('logout clears local tokens and returns to unauthenticated', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
      key.includes('accessToken') ? 'stored-access' : 'stored-refresh',
    );
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(DRIVER_USER);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
