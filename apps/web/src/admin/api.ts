import { authorizedRequestJson } from '../api/apiClient';
import type {
  AdminRoute,
  AdminUser,
  CreateRoutePayload,
  CreateUserPayload,
  UpdateRoutePayload,
  UpdateUserPayload,
} from './types';

/**
 * The Phase 2C ADMIN administration endpoints (`UserAdminController`,
 * `RouteAdminController`), used by the Phase 8 administration UI. Both list
 * endpoints return a plain array, not a `PageResponse` — there is no
 * server-side pagination on either, and none was added for this MVP.
 *
 * <p>There is deliberately no delete function for either resource: no such
 * endpoint exists, and no hard delete exists anywhere in V1 (root
 * CLAUDE.md §9.5, applied to users and routes too).
 */

export function listUsers(): Promise<AdminUser[]> {
  return authorizedRequestJson<AdminUser[]>('/admin/users');
}

export function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  return authorizedRequestJson<AdminUser>('/admin/users', { method: 'POST', body: payload });
}

/** A full replace — `payload` must always carry every field, per the backend's PUT contract. */
export function updateUser(userId: string, payload: UpdateUserPayload): Promise<AdminUser> {
  return authorizedRequestJson<AdminUser>(`/admin/users/${userId}`, { method: 'PUT', body: payload });
}

/**
 * `newPassword` is the only field the backend's `ResetPasswordRequest`
 * accepts — the current password is never sent, never requested, and never
 * readable. Responds `204 No Content`: nothing about the password is ever
 * echoed back.
 */
export function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  return authorizedRequestJson<void>(`/admin/users/${userId}/reset-password`, { method: 'POST', body: { newPassword } });
}

export function listRoutes(): Promise<AdminRoute[]> {
  return authorizedRequestJson<AdminRoute[]>('/admin/routes');
}

export function createRoute(payload: CreateRoutePayload): Promise<AdminRoute> {
  return authorizedRequestJson<AdminRoute>('/admin/routes', { method: 'POST', body: payload });
}

/** A full replace, same as {@link updateUser}. */
export function updateRoute(routeId: string, payload: UpdateRoutePayload): Promise<AdminRoute> {
  return authorizedRequestJson<AdminRoute>(`/admin/routes/${routeId}`, { method: 'PUT', body: payload });
}
