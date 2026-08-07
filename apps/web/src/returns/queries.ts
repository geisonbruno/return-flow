import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchDashboardSummary, fetchReturns, fetchRoutes, fetchUsers, type ReturnListParams } from './api';

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
