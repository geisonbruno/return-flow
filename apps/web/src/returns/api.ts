import { authorizedRequestBlob, authorizedRequestJson } from '../api/apiClient';
import { toApiRelativePath } from '../config/environment';
import type { AdminDashboardSummary, AdminReturnDetail, AdminReturnListItem, AdminRouteSummary, AdminUserSummary, PageResponse } from './types';

export function fetchDashboardSummary(): Promise<AdminDashboardSummary> {
  return authorizedRequestJson<AdminDashboardSummary>('/admin/dashboard/summary');
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
