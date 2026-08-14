import type { ReturnReason, ReturnStatus, ReturnUnit } from './types';

/**
 * `Record<ReturnReason, string>` deliberately, not a partial map with a
 * runtime fallback — mirrors `apps/mobile/src/returns/returnOptions.ts`'s
 * own convention: adding a new backend `ReturnReason` value without
 * updating this map is a TypeScript compile error, not a silently-wrong
 * label shown to an ADMIN. Duplicated here rather than shared with mobile
 * because the two apps deliberately share no UI/data code (root CLAUDE.md).
 */
export const REASON_LABELS: Record<ReturnReason, string> = {
  WRONG_ITEM_DELIVERED: 'Wrong item delivered',
  EXTRA_ITEM: 'Extra item',
  MISSING_ITEM: 'Missing item',
  CUSTOMER_CHARGE_REQUIRED: 'Customer charge required',
  NO_LONGER_REQUIRED: 'No longer required',
  WRONG_ITEM_ORDERED: 'Wrong item ordered',
  EXCHANGE_REQUIRED: 'Exchange required',
  DAMAGED: 'Damaged',
  LEAKING: 'Leaking',
  NOT_ORDERED: 'Not ordered',
  OTHER: 'Other',
};

/** Selection order matching root CLAUDE.md §10's canonical order. */
export const REASON_OPTIONS: readonly { value: ReturnReason; label: string }[] = (
  [
    'WRONG_ITEM_DELIVERED',
    'EXTRA_ITEM',
    'MISSING_ITEM',
    'CUSTOMER_CHARGE_REQUIRED',
    'NO_LONGER_REQUIRED',
    'WRONG_ITEM_ORDERED',
    'EXCHANGE_REQUIRED',
    'DAMAGED',
    'LEAKING',
    'NOT_ORDERED',
    'OTHER',
  ] as const
).map((value) => ({ value, label: REASON_LABELS[value] }));

export const UNIT_LABELS: Record<ReturnUnit, string> = {
  CTN: 'Carton',
  EA: 'Each',
};

/** e.g. "3 CTN", "12 EA" — the compact form used in table rows, not the long "Carton"/"Each" label. */
export function formatQuantityAndUnit(quantity: number, unit: ReturnUnit): string {
  return `${quantity} ${unit}`;
}

/**
 * `Record<ReturnStatus, string>` (not partial) for the same compile-time-safety
 * reason as `REASON_LABELS` — adding a new backend `ReturnStatus` value
 * without updating this map is a compile error, not a silently-blank label.
 */
export const STATUS_LABELS: Record<ReturnStatus, string> = {
  AWAITING_WAREHOUSE: 'Awaiting warehouse',
  IN_REVIEW: 'In review',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

/** Selection order matching the lifecycle in root CLAUDE.md §9. */
export const STATUS_OPTIONS: readonly { value: ReturnStatus; label: string }[] = (
  ['AWAITING_WAREHOUSE', 'IN_REVIEW', 'CLOSED', 'CANCELLED'] as const
).map((value) => ({ value, label: STATUS_LABELS[value] }));
