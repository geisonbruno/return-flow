import type { ReturnReason, ReturnStatus, ReturnUnit } from './types';

/**
 * `Record<ReturnReason, string>` deliberately, not a partial map with a
 * runtime fallback: adding a new backend `ReturnReason` value without
 * updating this map is a TypeScript compile error, not a silently-wrong
 * label shown to a driver.
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

/** Selection order for the Create Return reason picker, matching root CLAUDE.md §10's canonical order. */
export const REASON_OPTIONS: readonly { value: ReturnReason; label: string }[] = [
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
].map((value) => ({ value: value as ReturnReason, label: REASON_LABELS[value as ReturnReason] }));

export const UNIT_LABELS: Record<ReturnUnit, string> = {
  CTN: 'Carton',
  EA: 'Each',
};

export const UNIT_OPTIONS: readonly { value: ReturnUnit; label: string }[] = [
  { value: 'CTN', label: 'Carton' },
  { value: 'EA', label: 'Each' },
];

export const STATUS_LABELS: Record<ReturnStatus, string> = {
  AWAITING_WAREHOUSE: 'Awaiting warehouse',
};

/** e.g. "3 CTN", "12 EA" — the compact form used in list rows, not the long "Carton"/"Each" label. */
export function formatQuantityAndUnit(quantity: number, unit: ReturnUnit): string {
  return `${quantity} ${unit}`;
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** e.g. "2 Aug 2026, 11:15 am" — the only place a backend ISO timestamp is turned into user-facing text. */
export function formatDateTime(isoTimestamp: string): string {
  return DATE_TIME_FORMATTER.format(new Date(isoTimestamp)).replace(/\s?(AM|PM)$/i, (match) => match.toLowerCase());
}
