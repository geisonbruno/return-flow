import type { ReturnReason, ReturnStatus } from './types';

export const RETURNS_PAGE_SIZE = 25;

export interface ReturnsFilters {
  page: number;
  search: string;
  status: ReturnStatus | '';
  reason: ReturnReason | '';
  createdFrom: string;
  createdTo: string;
  /**
   * Filters on `closedAt`, independently of `createdFrom`/`createdTo` — used
   * by the Dashboard's Closed Today shortcut so the returns it links to
   * match the same `closedAt`-based set the card's own count represents
   * (`docs/WEB_UX.md` §5). No dedicated filter-bar input exists for this
   * dimension yet; it is reachable only via that shortcut's URL, the same
   * way every other filter here is URL-addressable.
   */
  closedFrom: string;
  closedTo: string;
  driverId: string;
  routeId: string;
}

export const EMPTY_FILTERS: ReturnsFilters = {
  page: 0,
  search: '',
  status: '',
  reason: '',
  createdFrom: '',
  createdTo: '',
  closedFrom: '',
  closedTo: '',
  driverId: '',
  routeId: '',
};

const VALID_STATUSES: readonly ReturnStatus[] = ['AWAITING_WAREHOUSE', 'IN_REVIEW', 'CLOSED', 'CANCELLED'];
const VALID_REASONS: readonly ReturnReason[] = [
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
];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shared with `ReturnDetailsPage` — a route param that isn't a well-formed UUID is never sent to the API; it fails safe as "not found" immediately. */
export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function sanitizeEnum<T extends string>(raw: string | null, valid: readonly T[]): T | '' {
  return raw !== null && (valid as readonly string[]).includes(raw) ? (raw as T) : '';
}

function sanitizeDate(raw: string | null): string {
  return raw !== null && DATE_PATTERN.test(raw) ? raw : '';
}

function sanitizeUuid(raw: string | null): string {
  return raw !== null && UUID_PATTERN.test(raw) ? raw : '';
}

function sanitizePage(raw: string | null): number {
  const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Reads the Returns page's filter/pagination state from the URL query
 * string. Every value is individually validated — a malformed or unknown
 * value (a hand-edited URL, a stale bookmark, a future enum value this
 * build doesn't know about) silently falls back to "no filter" rather than
 * being sent to the API or crashing the page.
 */
export function parseReturnsFilters(searchParams: URLSearchParams): ReturnsFilters {
  return {
    page: sanitizePage(searchParams.get('page')),
    search: searchParams.get('search') ?? '',
    status: sanitizeEnum(searchParams.get('status'), VALID_STATUSES),
    reason: sanitizeEnum(searchParams.get('reason'), VALID_REASONS),
    createdFrom: sanitizeDate(searchParams.get('createdFrom')),
    createdTo: sanitizeDate(searchParams.get('createdTo')),
    closedFrom: sanitizeDate(searchParams.get('closedFrom')),
    closedTo: sanitizeDate(searchParams.get('closedTo')),
    driverId: sanitizeUuid(searchParams.get('driverId')),
    routeId: sanitizeUuid(searchParams.get('routeId')),
  };
}

/** Builds the URL query string for a filter state — omits `page=0` and every empty field to keep the URL free of noise. */
export function filtersToSearchParams(filters: ReturnsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.page > 0) params.set('page', String(filters.page));
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.reason) params.set('reason', filters.reason);
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) params.set('createdTo', filters.createdTo);
  if (filters.closedFrom) params.set('closedFrom', filters.closedFrom);
  if (filters.closedTo) params.set('closedTo', filters.closedTo);
  if (filters.driverId) params.set('driverId', filters.driverId);
  if (filters.routeId) params.set('routeId', filters.routeId);
  return params;
}

/** True when no search text and no filter is active — used to distinguish "empty tenant" from "no results match the filters." */
export function hasActiveFilters(filters: ReturnsFilters): boolean {
  return Boolean(
    filters.search ||
      filters.status ||
      filters.reason ||
      filters.createdFrom ||
      filters.createdTo ||
      filters.closedFrom ||
      filters.closedTo ||
      filters.driverId ||
      filters.routeId,
  );
}

/** `createdFrom` after `createdTo` can never return a sensible range — checked client-side purely for immediate feedback; the backend independently re-validates. */
export function isInvalidDateRange(filters: ReturnsFilters): boolean {
  return Boolean(filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo);
}
