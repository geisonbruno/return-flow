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

/**
 * Matches `returnrecord.dto.ReturnPhotoResponse` exactly — public metadata
 * only. No storageKey, tenantId, driverId, or filesystem path: `contentPath`
 * is an API-relative path (never an absolute/localhost URL, never a token in
 * the query string) resolved against the app's own configured API base URL.
 */
export interface ReturnPhoto {
  id: string;
  contentType: string;
  sizeBytes: number;
  position: number;
  contentPath: string;
  createdAt: string;
}

/**
 * Matches `returnrecord.dto.ReturnSignatureResponse` exactly — public
 * metadata only. No storageKey, tenantId, driverId, raw strokes, or the
 * generated SVG: `contentPath` is an API-relative path resolved against the
 * app's own configured API base URL, mirroring {@link ReturnPhoto.contentPath}.
 */
export interface ReturnSignature {
  id: string;
  signerName: string;
  contentType: string;
  sizeBytes: number;
  contentPath: string;
  signedAt: string;
}

/** One already-captured stroke point, normalized to the signature pad's own bounds — 0..1 on both axes, independent of the pad's actual pixel size. */
export interface SignaturePoint {
  x: number;
  y: number;
}

export type SignatureStroke = SignaturePoint[];

/**
 * Matches `returnrecord.dto.CreateReturnSignatureRequest` exactly. Never
 * includes tenantId, driverId, signedAt, storageKey, SVG, Base64, or return
 * status — only the signer's name and the normalized stroke geometry itself.
 */
export interface CreateReturnSignaturePayload {
  signerName: string;
  strokes: SignatureStroke[];
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
  /** Always an array — empty right after creation, never null. */
  photos: ReturnPhoto[];
  /** `null` until the driver captures the customer signature — clients read "pending" from this nullability rather than a separate boolean flag. */
  signature: ReturnSignature | null;
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
