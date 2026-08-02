/** Matches the backend's `returnrecord.ReturnReason` — see root CLAUDE.md §10. */
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

/** Matches the backend's `returnrecord.ReturnUnit` — CTN (Carton) and EA (Each) only. */
export type ReturnUnit = 'CTN' | 'EA';

/** Only status that exists in V1 — see `returnrecord.ReturnStatus`. */
export type ReturnStatus = 'AWAITING_WAREHOUSE';

/** Matches `returnrecord.dto.DriverSummaryResponse`. */
export interface DriverSummary {
  id: string;
  fullName: string;
}

/** Matches `route.dto.RouteSummaryResponse`. */
export interface RouteSummary {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

/** Matches `returnrecord.dto.ReturnResponse` exactly — the driver API's response contract. */
export interface ReturnRecord {
  id: string;
  returnNumber: string;
  customerName: string;
  productName: string;
  reason: ReturnReason;
  reasonDetails: string | null;
  quantity: number;
  unit: ReturnUnit;
  observation: string;
  status: ReturnStatus;
  driver: DriverSummary;
  route: RouteSummary;
  createdAt: string;
  updatedAt: string;
}

/**
 * Matches `returnrecord.dto.CreateReturnRequest` exactly — only these seven
 * fields are ever sent. No tenantId, driverId, routeId, returnNumber,
 * status, createdAt, or updatedAt: those are always server-derived.
 */
export interface CreateReturnPayload {
  customerName: string;
  productName: string;
  reason: ReturnReason;
  reasonDetails?: string;
  quantity: number;
  unit: ReturnUnit;
  observation: string;
}
