import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchDashboardSummary, fetchMediaBlob, fetchReturnDetail, fetchReturns, fetchRoutes, fetchUsers, type ReturnListParams } from './api';

/** Modest, per `apps/web/CLAUDE.md` ("simple polling is acceptable; WebSockets and browser push are not") — not real-time. */
const DASHBOARD_REFETCH_INTERVAL_MS = 30_000;
const LATEST_RETURNS_SIZE = 5;

export const dashboardSummaryQueryKey = ['admin', 'dashboard', 'summary'] as const;

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryQueryKey,
    queryFn: fetchDashboardSummary,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
    // Only polls while the tab is actually visible/focused — no background
    // polling from an inactive tab.
    refetchIntervalInBackground: false,
  });
}

export function latestReturnsQueryKey(size: number) {
  return ['admin', 'returns', 'latest', size] as const;
}

export function useLatestReturns(size: number = LATEST_RETURNS_SIZE) {
  return useQuery({
    queryKey: latestReturnsQueryKey(size),
    queryFn: () => fetchReturns({ page: 0, size }),
    refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

/**
 * Every filter/page value is part of the query key, so each distinct filter
 * combination is its own cache entry — TanStack Query never lets an
 * in-flight request for an old filter combination overwrite a newer one's
 * result, which is what actually prevents the "stale result after a fast
 * filter change" bug, not manual request cancellation.
 */
export function returnsListQueryKey(params: ReturnListParams) {
  return ['admin', 'returns', 'list', params] as const;
}

export function useReturnsList(params: ReturnListParams) {
  return useQuery({
    queryKey: returnsListQueryKey(params),
    queryFn: () => fetchReturns(params),
    // Keeps the previous page's rows visible (instead of a loading flash)
    // while the next page/filter combination loads.
    placeholderData: keepPreviousData,
  });
}

const FILTER_OPTIONS_STALE_TIME_MS = 5 * 60_000;

export const driverOptionsQueryKey = ['admin', 'users', 'drivers'] as const;

export function useDriverOptions() {
  return useQuery({
    queryKey: driverOptionsQueryKey,
    queryFn: fetchUsers,
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    select: (users) => users.filter((user) => user.role === 'DRIVER'),
  });
}

export const routeOptionsQueryKey = ['admin', 'routes', 'options'] as const;

export function useRouteOptions() {
  return useQuery({
    queryKey: routeOptionsQueryKey,
    queryFn: fetchRoutes,
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
  });
}

export function returnDetailQueryKey(returnId: string) {
  return ['admin', 'returns', 'detail', returnId] as const;
}

export function useReturnDetail(returnId: string, enabled: boolean) {
  return useQuery({
    queryKey: returnDetailQueryKey(returnId),
    queryFn: () => fetchReturnDetail(returnId),
    enabled,
  });
}

/**
 * `contentPath` alone is a sufficient, globally unique cache key — it
 * already embeds the return ID (and photo ID, for a photo), so media from
 * one return can never collide with or be shown for another.
 */
export function mediaBlobQueryKey(contentPath: string) {
  return ['admin', 'media', contentPath] as const;
}

/**
 * `gcTime: 0` deliberately does not retain a fetched Blob in the query
 * cache once nothing is displaying it — these are private, potentially
 * multi-megabyte photo/signature bytes, unlike the small JSON queries
 * elsewhere in this module, which keep TanStack Query's normal defaults.
 */
export function useMediaBlob(contentPath: string | null | undefined) {
  return useQuery({
    queryKey: mediaBlobQueryKey(contentPath ?? ''),
    queryFn: () => fetchMediaBlob(contentPath as string),
    enabled: Boolean(contentPath),
    gcTime: 0,
    staleTime: 0,
  });
}
