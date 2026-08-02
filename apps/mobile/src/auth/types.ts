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
