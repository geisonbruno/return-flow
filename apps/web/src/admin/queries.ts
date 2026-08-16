import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { createRoute, createUser, listRoutes, listUsers, resetUserPassword, updateRoute, updateUser } from './api';
import type { CreateRoutePayload, CreateUserPayload, UpdateRoutePayload, UpdateUserPayload } from './types';

export const adminUsersQueryKey = ['admin', 'users', 'list'] as const;
export const adminRoutesQueryKey = ['admin', 'routes', 'list'] as const;

export function useAdminUsers() {
  return useQuery({ queryKey: adminUsersQueryKey, queryFn: listUsers });
}

/**
 * The single source of route options for the whole administration UI — the
 * Routes page's own table and the Users page's route selector both read this
 * one query, so a newly created route is immediately selectable when
 * assigning a driver without any second lookup endpoint.
 */
export function useAdminRoutes() {
  return useQuery({ queryKey: adminRoutesQueryKey, queryFn: listRoutes });
}

/**
 * Invalidating the whole `['admin','users']` prefix rather than only this
 * page's own list key is deliberate: the Returns page's driver filter
 * (`returns/queries.ts`'s `driverOptionsQueryKey`) reads the very same
 * `GET /admin/users` endpoint, so a user created or renamed here would
 * otherwise leave that dropdown stale.
 */
function invalidateUsers(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
}

/**
 * Same prefix reasoning as {@link invalidateUsers} for the Returns page's
 * route filter — plus an explicit user invalidation, because every user's
 * nested `route` summary embeds the route's code/name/active state and would
 * otherwise still show the pre-edit values.
 */
function invalidateRoutes(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'routes'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) => updateUser(userId, payload),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

/**
 * Deliberately invalidates nothing: a password reset changes no field the
 * user list displays, and the new password must not be retained anywhere —
 * not in a cache, not in a mutation result (the backend returns 204).
 */
export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) => resetUserPassword(userId, newPassword),
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoutePayload) => createRoute(payload),
    onSuccess: () => invalidateRoutes(queryClient),
  });
}

export function useUpdateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, payload }: { routeId: string; payload: UpdateRoutePayload }) => updateRoute(routeId, payload),
    onSuccess: () => invalidateRoutes(queryClient),
  });
}
