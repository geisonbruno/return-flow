import { authorizedRequestBlob, authorizedRequestJson } from '../api/apiClient';
import { toApiRelativePath } from '../config/environment';
import type {
  AdminDashboardSummary,
  DashboardAnalytics,
  AdminReturnDetail,
  AdminReturnListItem,
  AdminRouteSummary,
  AdminUserSummary,
  CloseReturnPayload,
  PageResponse,
} from './types';

export function fetchDashboardSummary(): Promise<AdminDashboardSummary> {
  return authorizedRequestJson<AdminDashboardSummary>('/admin/dashboard/summary');
}

export function fetchDashboardAnalytics(from: string, to: string): Promise<DashboardAnalytics> {
  const query = new URLSearchParams({ from, to });
  return authorizedRequestJson<DashboardAnalytics>(`/admin/dashboard/analytics?${query.toString()}`);
}

/** Every filter is optional and omitted from the query string entirely when absent — never sent as an empty string. */
export interface ReturnListParams {
  page: number;
  size: number;
  search?: string;
  status?: string;
  reason?: string;
  createdFrom?: string;
  createdTo?: string;
  /** Filters on `closedAt` (Phase 7B) — see `returns/filters.ts`'s `ReturnsFilters.closedFrom`/`closedTo`. */
  closedFrom?: string;
  closedTo?: string;
  driverId?: string;
  routeId?: string;
}

function buildReturnListQuery(params: ReturnListParams): string {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('size', String(params.size));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.reason) query.set('reason', params.reason);
  if (params.createdFrom) query.set('createdFrom', params.createdFrom);
  if (params.createdTo) query.set('createdTo', params.createdTo);
  if (params.closedFrom) query.set('closedFrom', params.closedFrom);
  if (params.closedTo) query.set('closedTo', params.closedTo);
  if (params.driverId) query.set('driverId', params.driverId);
  if (params.routeId) query.set('routeId', params.routeId);
  return query.toString();
}

export function fetchReturns(params: ReturnListParams): Promise<PageResponse<AdminReturnListItem>> {
  return authorizedRequestJson<PageResponse<AdminReturnListItem>>(`/admin/returns?${buildReturnListQuery(params)}`);
}

/** Read-only reuse of the existing ADMIN user list, for the Returns page's driver filter dropdown only — no user administration here (Phase 8). */
export function fetchUsers(): Promise<AdminUserSummary[]> {
  return authorizedRequestJson<AdminUserSummary[]>('/admin/users');
}

/** Read-only reuse of the existing ADMIN route list, for the Returns page's route filter dropdown only — no route administration here (Phase 8). */
export function fetchRoutes(): Promise<AdminRouteSummary[]> {
  return authorizedRequestJson<AdminRouteSummary[]>('/admin/routes');
}

export function fetchReturnDetail(returnId: string): Promise<AdminReturnDetail> {
  return authorizedRequestJson<AdminReturnDetail>(`/admin/returns/${returnId}`);
}

/** `contentPath` is a backend-provided `ReturnPhotoResponse`/`ReturnSignatureResponse` value — resolved before the request so it is never combined with the API base twice. */
export function fetchMediaBlob(contentPath: string): Promise<Blob> {
  return authorizedRequestBlob(toApiRelativePath(contentPath));
}

/**
 * The Phase 7A warehouse-review lifecycle actions. Every one of these posts
 * no body except where the backend's own request DTO requires one, and every
 * one returns the same `AdminReturnDetailResponse` shape `fetchReturnDetail`
 * does, reflecting the return's new authoritative state after the
 * transition (`AdminReturnReviewController`).
 */
export function startReview(returnId: string): Promise<AdminReturnDetail> {
  return authorizedRequestJson<AdminReturnDetail>(`/admin/returns/${returnId}/start-review`, { method: 'POST' });
}

export function releaseReview(returnId: string): Promise<AdminReturnDetail> {
  return authorizedRequestJson<AdminReturnDetail>(`/admin/returns/${returnId}/release-review`, { method: 'POST' });
}

/** `expectedCurrentReviewerId` must be the reviewer ID currently shown by the authoritative detail response — never a stale cached value. */
export function takeOverReview(returnId: string, expectedCurrentReviewerId: string): Promise<AdminReturnDetail> {
  return authorizedRequestJson<AdminReturnDetail>(`/admin/returns/${returnId}/take-over-review`, {
    method: 'POST',
    body: { expectedCurrentReviewerId },
  });
}

/** The single atomic Close request — every required warehouse field and the normalized signature strokes together, per root CLAUDE.md §12 / `docs/WEB_UX.md` §8. */
export function closeReturn(returnId: string, payload: CloseReturnPayload): Promise<AdminReturnDetail> {
  return authorizedRequestJson<AdminReturnDetail>(`/admin/returns/${returnId}/close`, { method: 'POST', body: payload });
}

export function cancelReturn(returnId: string, reason: string): Promise<AdminReturnDetail> {
  return authorizedRequestJson<AdminReturnDetail>(`/admin/returns/${returnId}/cancel`, { method: 'POST', body: { reason } });
}

/**
 * The Phase 9 administrative PDF for a closed return. Fetched as an
 * authenticated `Blob` through the same bearer-token client every other
 * request uses — never a plain link, `window.open`, or a token in the URL,
 * none of which can carry the memory-only access token. The request sends
 * nothing but the return ID: the backend builds the document from the
 * database, so no value displayed here can influence it.
 */
export function fetchReturnPdf(returnId: string): Promise<Blob> {
  return authorizedRequestBlob(`/admin/returns/${returnId}/pdf`);
}
