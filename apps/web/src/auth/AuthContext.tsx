import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { clearSession as clearApiSession, onSessionExpired, setAccessToken } from '../api/apiClient';
import * as authService from './authService';
import * as tokenStorage from './tokenStorage';
import type { AuthenticatedUser } from './types';

export type AuthStatus = 'restoring' | 'unauthenticated' | 'authenticated';

export const ADMIN_ONLY_MESSAGE = 'This application is available to ReturnFlow administrators only.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

/** Thrown by {@link AuthContextValue.login} when the authenticated account is not an ADMIN — distinct from `ApiError` so the Login page can show a different message. */
export class UnauthorizedRoleError extends Error {}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  /** Set when the previous session ended for a reason the ADMIN should see on the Login page (expiry, wrong role). */
  sessionMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/** Exported only so tests can supply a fixed `AuthContextValue` directly (see `pages/ReturnDetailsPage.test.tsx`) without re-running the full session-restoration network flow `AuthProvider` performs on mount. */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const clearLocalSession = useCallback(
    (message: string | null) => {
      clearApiSession();
      queryClient.clear();
      setUser(null);
      setSessionMessage(message);
      setStatus('unauthenticated');
    },
    [queryClient],
  );

  useEffect(() => {
    onSessionExpired(() => {
      clearLocalSession(SESSION_EXPIRED_MESSAGE);
    });
  }, [clearLocalSession]);

  useEffect(() => {
    (async () => {
      const stored = tokenStorage.loadRefreshToken();
      if (!stored) {
        setStatus('unauthenticated');
        return;
      }
      try {
        const session = await authService.refresh(stored);
        tokenStorage.saveRefreshToken(session.refreshToken);
        setAccessToken(session.accessToken);
        const currentUser = await authService.getCurrentUser();
        if (currentUser.role !== 'ADMIN') {
          clearLocalSession(null);
          return;
        }
        setUser(currentUser);
        setStatus('authenticated');
      } catch {
        clearLocalSession(null);
      }
    })();
    // Runs once at app startup only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authService.login(email, password);
      tokenStorage.saveRefreshToken(session.refreshToken);
      setAccessToken(session.accessToken);
      let currentUser: AuthenticatedUser;
      try {
        currentUser = await authService.getCurrentUser();
      } catch (error) {
        clearLocalSession(null);
        throw error;
      }
      if (currentUser.role !== 'ADMIN') {
        await authService.logout(session.refreshToken);
        clearLocalSession(null);
        throw new UnauthorizedRoleError(ADMIN_ONLY_MESSAGE);
      }
      setUser(currentUser);
      setSessionMessage(null);
      setStatus('authenticated');
    },
    [clearLocalSession],
  );

  const logout = useCallback(async () => {
    // Read from storage rather than tracking the refresh token in React
    // state — a background rotation (see apiClient's automatic 401 retry)
    // keeps storage current, so this is always the freshest token.
    const stored = tokenStorage.loadRefreshToken();
    if (stored) {
      await authService.logout(stored);
    }
    clearLocalSession(null);
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
