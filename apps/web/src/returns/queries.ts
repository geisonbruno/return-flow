import { keepPreviousData, useMutation, useQueryClient, type QueryClient, useQuery } from '@tanstack/react-query';

import {
  cancelReturn,
  closeReturn,
  fetchDashboardSummary,
  fetchDashboardAnalytics,
  fetchMediaBlob,
  fetchReturnDetail,
  fetchReturnPdf,
  fetchReturns,
  fetchRoutes,
  fetchUsers,
  releaseReview,
  startReview,
  takeOverReview,
  type ReturnListParams,
} from './api';
import type { AdminReturnDetail, CloseReturnPayload } from './types';

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

export function dashboardAnalyticsQueryKey(from: string, to: string) {
  return ['admin', 'dashboard', 'analytics', from, to] as const;
}

export function useDashboardAnalytics(from: string | null, to: string | null) {
  return useQuery({
    queryKey: dashboardAnalyticsQueryKey(from ?? '', to ?? ''),
    queryFn: () => fetchDashboardAnalytics(from as string, to as string),
    enabled: Boolean(from && to),
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

/**
 * Every Phase 7A lifecycle mutation returns the return's new authoritative
 * `AdminReturnDetailResponse`, so the detail cache is written directly from
 * that response rather than waiting on a refetch. The returns list, Latest
 * Returns, and dashboard summary are invalidated too — a status/reviewer
 * change on one return can change counts and rows shown elsewhere, and none
 * of those queries carry enough context to be patched in place safely.
 */
function afterLifecycleChange(queryClient: QueryClient, returnId: string, detail: AdminReturnDetail) {
  queryClient.setQueryData(returnDetailQueryKey(returnId), detail);
  void queryClient.invalidateQueries({ queryKey: ['admin', 'returns', 'list'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'returns', 'latest'] });
  void queryClient.invalidateQueries({ queryKey: dashboardSummaryQueryKey });
}

export function useStartReview(returnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startReview(returnId),
    onSuccess: (detail) => afterLifecycleChange(queryClient, returnId, detail),
  });
}

export function useReleaseReview(returnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => releaseReview(returnId),
    onSuccess: (detail) => afterLifecycleChange(queryClient, returnId, detail),
  });
}

export function useTakeOverReview(returnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expectedCurrentReviewerId: string) => takeOverReview(returnId, expectedCurrentReviewerId),
    onSuccess: (detail) => afterLifecycleChange(queryClient, returnId, detail),
  });
}

export function useCloseReturn(returnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CloseReturnPayload) => closeReturn(returnId, payload),
    onSuccess: (detail) => afterLifecycleChange(queryClient, returnId, detail),
  });
}

export function useCancelReturn(returnId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => cancelReturn(returnId, reason),
    onSuccess: (detail) => afterLifecycleChange(queryClient, returnId, detail),
  });
}

/**
 * Requesting the administrative PDF is a read, not a lifecycle transition —
 * so unlike every mutation above it invalidates nothing and writes nothing to
 * the cache. It is a `useMutation` purely because it is user-triggered rather
 * than render-driven, which also gives each caller its own `isPending` guard
 * against a second request while one is already in flight. The `Blob` is
 * deliberately not cached: it would pin several hundred KB per viewed return
 * in memory for no benefit.
 *
 * <p>Called once per action (Download and Print), so each button gets an
 * independent pending state and neither can disable the other.
 */
export function useReturnPdf(returnId: string) {
  return useMutation({
    mutationFn: () => fetchReturnPdf(returnId),
  });
}
