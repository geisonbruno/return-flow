/** Mirrors the backend's `returnrecord.ReturnStatus` — only `AWAITING_WAREHOUSE` exists until Phase 7A. */
export type ReturnStatus = 'AWAITING_WAREHOUSE';

/** Mirrors the backend's `returnrecord.ReturnReason` (root CLAUDE.md §10), exactly. */
export type ReturnReason =
  | 'WRONG_ITEM_DELIVERED'
  | 'EXTRA_ITEM'
  | 'MISSING_ITEM'
  | 'CUSTOMER_CHARGE_REQUIRED'
  | 'NO_LONGER_REQUIRED'
  | 'WRONG_ITEM_ORDERED'
  | 'EXCHANGE_REQUIRED'
  | 'DAMAGED'
  | 'LEAKING'
  | 'NOT_ORDERED'
  | 'OTHER';

/** Mirrors the backend's `returnrecord.ReturnUnit`. */
export type ReturnUnit = 'CTN' | 'EA';

/** Matches the backend's `returnrecord.dto.DriverSummaryResponse`. */
export interface DriverSummary {
  id: string;
  fullName: string;
}

/** Matches the backend's `route.dto.RouteSummaryResponse`. */
export interface RouteSummary {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

/** Matches the backend's `returnrecord.dto.AdminReturnSummaryResponse` (GET /admin/dashboard/summary). */
export interface AdminDashboardSummary {
  waitingWarehouse: number;
  inReview: number;
  closedToday: number;
  returnsToday: number;
}

/** Matches the backend's `returnrecord.dto.AdminReturnListItemResponse` (one row of GET /admin/returns). */
export interface AdminReturnListItem {
  id: string;
  returnNumber: string;
  customerName: string;
  productName: string;
  quantity: number;
  unit: ReturnUnit;
  reason: ReturnReason;
  status: ReturnStatus;
  driver: DriverSummary;
  route: RouteSummary;
  createdAt: string;
  photoCount: number;
  hasSignature: boolean;
}

/** Matches the backend's `common.web.PageResponse<T>`. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Matches the backend's `user.dto.UserResponse` — only the fields this module reads. */
export interface AdminUserSummary {
  id: string;
  name: string;
  role: 'DRIVER' | 'ADMIN';
  active: boolean;
}

/** Matches the backend's `route.dto.RouteResponse` — only the fields this module reads. */
export interface AdminRouteSummary {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

/** Matches the backend's `returnrecord.dto.ReturnPhotoResponse`. `contentPath` already includes the API version prefix — see `config/environment.ts`'s `toApiRelativePath`. */
export interface ReturnPhoto {
  id: string;
  contentType: string;
  sizeBytes: number;
  position: number;
  contentPath: string;
  createdAt: string;
}

/** Matches the backend's `returnrecord.dto.ReturnSignatureResponse`. */
export interface ReturnSignature {
  id: string;
  signerName: string;
  contentType: string;
  sizeBytes: number;
  contentPath: string;
  signedAt: string;
}

/** Matches the backend's `returnrecord.dto.AdminReturnDetailResponse` (GET /admin/returns/{returnId}). No reviewer/warehouse/cancellation fields — none exist until Phase 7A. */
export interface AdminReturnDetail {
  id: string;
  returnNumber: string;
  status: ReturnStatus;
  customerName: string;
  productName: string;
  quantity: number;
  unit: ReturnUnit;
  reason: ReturnReason;
  reasonDetails: string | null;
  observation: string | null;
  driver: DriverSummary;
  route: RouteSummary;
  photos: ReturnPhoto[];
  signature: ReturnSignature | null;
  createdAt: string;
  updatedAt: string;
}
