import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { onSessionExpired, setSession as setApiSession } from '../api/apiClient';
import * as authService from './authService';
import * as tokenStorage from './tokenStorage';
import type { AuthenticatedUser } from './types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export const DRIVER_ONLY_MESSAGE = 'This app is available to drivers only.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  /** Set when the previous session ended for a reason the driver should see on the Login screen (expiry, wrong role). */
  sessionMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const clearLocalSession = useCallback(async (message: string | null) => {
    await tokenStorage.clearTokens();
    setApiSession(null);
    setUser(null);
    setSessionMessage(message);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      void clearLocalSession(SESSION_EXPIRED_MESSAGE);
    });
  }, [clearLocalSession]);

  useEffect(() => {
    (async () => {
      const stored = await tokenStorage.loadTokens();
      if (!stored) {
        setStatus('unauthenticated');
        return;
      }
      setApiSession(stored);
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser.role !== 'DRIVER') {
          await clearLocalSession(DRIVER_ONLY_MESSAGE);
          return;
        }
        setUser(currentUser);
        setStatus('authenticated');
      } catch {
        await clearLocalSession(null);
      }
    })();
    // Runs once at app startup only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await authService.login(email, password);
    setApiSession(session);
    const currentUser = await authService.getCurrentUser();
    if (currentUser.role !== 'DRIVER') {
      setApiSession(null);
      throw new Error(DRIVER_ONLY_MESSAGE);
    }
    await tokenStorage.saveTokens(session);
    setUser(currentUser);
    setSessionMessage(null);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    // Read from storage rather than tracking the refresh token in React
    // state — a background rotation (see apiClient's automatic 401 retry)
    // keeps storage current, so this is always the freshest token pair.
    const stored = await tokenStorage.loadTokens();
    if (stored) {
      await authService.logout(stored.refreshToken);
    }
    await clearLocalSession(null);
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, sessionMessage, login, logout }),
    [status, user, sessionMessage, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
