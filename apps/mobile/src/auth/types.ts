export type UserRole = 'DRIVER' | 'ADMIN';

/** Matches the backend's {@code AuthSessionResponse} (POST /api/v1/auth/login, /refresh). */
export interface AuthSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  tokenType: string;
}

/** Matches the backend's {@code AuthenticatedUserResponse} (GET /api/v1/auth/me). */
export interface AuthenticatedUser {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
}

/**
 * The two values persisted between the native (`tokenStorage.ts`, Expo
 * SecureStore) and web (`tokenStorage.web.ts`, localStorage) platform
 * implementations — kept here so both share one contract instead of two
 * independently-declared, driftable copies.
 */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}
