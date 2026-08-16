/** Mirrors the backend's `user.UserRole` — exactly two roles in V1 (root CLAUDE.md §6). */
export type AdminUserRole = 'DRIVER' | 'ADMIN';

/**
 * The nested route on a user response — matches the backend's
 * `route.dto.RouteSummaryResponse`. `name` is nullable because the backend's
 * route name is genuinely optional (`CreateRouteRequest.name` carries only
 * `@Size`, not `@NotBlank`).
 */
export interface UserRouteSummary {
  id: string;
  code: string;
  name: string | null;
  active: boolean;
}

/**
 * Matches the backend's `user.dto.UserResponse` in full. That DTO
 * deliberately excludes `passwordHash` and any token data, so there is
 * nothing sensitive to omit here — this type is the complete response.
 * `route` is always `null` for an ADMIN.
 */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  active: boolean;
  route: UserRouteSummary | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Matches the backend's `user.dto.CreateUserRequest`. There is no `active`
 * field: created users are always active. `routeId` must be omitted for an
 * ADMIN and present for a DRIVER — a rule `UserAdminService` enforces, since
 * it depends on `role`.
 */
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: AdminUserRole;
  routeId?: string | null;
}

/**
 * Matches the backend's `user.dto.UpdateUserRequest` — a full replace (PUT
 * semantics), never a partial patch, so every field is always sent.
 */
export interface UpdateUserPayload {
  name: string;
  email: string;
  role: AdminUserRole;
  routeId: string | null;
  active: boolean;
}

/** Matches the backend's `route.dto.RouteResponse`. */
export interface AdminRoute {
  id: string;
  code: string;
  name: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Matches the backend's `route.dto.CreateRouteRequest`. Routes are always created active — there is no `active` field. */
export interface CreateRoutePayload {
  code: string;
  name: string | null;
}

/** Matches the backend's `route.dto.UpdateRouteRequest` — a full replace (PUT semantics), same as {@link UpdateUserPayload}. */
export interface UpdateRoutePayload {
  code: string;
  name: string | null;
  active: boolean;
}
