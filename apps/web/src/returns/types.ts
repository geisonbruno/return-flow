/** Mirrors the backend's `returnrecord.ReturnStatus` (Phase 7A): the complete four-value lifecycle. */
export type ReturnStatus = 'AWAITING_WAREHOUSE' | 'IN_REVIEW' | 'CLOSED' | 'CANCELLED';

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

/** Matches the backend's `returnrecord.dto.AdminSummaryResponse` — the small nested ADMIN representation embedded as reviewer, closer, or canceller. */
export interface AdminSummary {
  id: string;
  fullName: string;
}

/** One point of a normalized (0..1) signature stroke — mirrors the backend's `SignaturePointRequest`. */
export interface SignaturePoint {
  x: number;
  y: number;
}

export type SignatureStroke = SignaturePoint[];

/** Matches the backend's `returnrecord.dto.AdminReturnSummaryResponse` (GET /admin/dashboard/summary). */
export interface AdminDashboardSummary {
  waitingWarehouse: number;
  inReview: number;
  closedToday: number;
  returnsToday: number;
}

export interface DashboardAnalytics {
  from: string;
  to: string;
  returnsOverTime: DashboardReturnsOverTimePoint[];
  reasonsDistribution: DashboardReasonDistribution[];
  topRoutes: DashboardTopRoute[];
}

export interface DashboardReturnsOverTimePoint {
  date: string;
  count: number;
}

export interface DashboardReasonDistribution {
  reason: ReturnReason;
  count: number;
}

export interface DashboardTopRoute {
  routeId: string;
  routeCode: string;
  routeName: string;
  count: number;
}

/**
 * Matches the backend's `returnrecord.dto.AdminReturnListItemResponse` (one
 * row of GET /admin/returns). `reviewer` is `null` until a review has
 * started and remains set after `CLOSED` — a return cancelled before any
 * review starts keeps it `null` (root CLAUDE.md §17.2).
 */
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
  reviewer: AdminSummary | null;
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

/**
 * Matches the backend's `returnrecord.dto.AdminReturnDetailResponse` (GET
 * /admin/returns/{returnId}, and every Phase 7A lifecycle action response).
 * Everything from `reviewer` onward is `null` until the corresponding
 * transition happens: `reviewer`/`reviewStartedAt` only while/after a review
 * has started; the warehouse decision fields only once `CLOSED`;
 * `cancelledBy`/`cancelledAt`/`cancellationReason` only once `CANCELLED`.
 * `warehouseRepresentativeName` is derived from `warehouseSignature.signerName`
 * on the backend — the same pattern the customer side already uses.
 */
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
  reviewer: AdminSummary | null;
  reviewStartedAt: string | null;
  sellable: boolean | null;
  creditCustomer: boolean | null;
  chargeCustomer: boolean | null;
  chargeDriver: boolean | null;
  warehouseObservation: string | null;
  warehouseRepresentativeName: string | null;
  warehouseSignature: ReturnSignature | null;
  closedBy: AdminSummary | null;
  closedAt: string | null;
  cancelledBy: AdminSummary | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Request payload for `POST /admin/returns/{id}/close` — matches the backend's `CloseReturnRequest` exactly. */
export interface CloseReturnPayload {
  sellable: boolean;
  creditCustomer: boolean;
  chargeCustomer: boolean;
  chargeDriver: boolean;
  warehouseObservation?: string;
  warehouseRepresentativeName: string;
  warehouseSignatureStrokes: SignatureStroke[];
}
