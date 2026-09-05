/**
 * The server-configured operational timezone (`app.operations.business-timezone`,
 * default `Australia/Sydney` — see `apps/api`'s `OperationalDayService`). The
 * browser's own timezone must never silently determine "today" or how a
 * timestamp displays; every ADMIN sees the same operational day regardless
 * of where they're browsing from (`docs/WEB_UX.md` §5).
 */
const OPERATIONAL_TIME_ZONE = 'Australia/Sydney';

/** `en-CA` is the standard `Intl` trick for a locale-formatted `YYYY-MM-DD` date without manual string building. */
const sydneyDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: OPERATIONAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Today's calendar date in the operational timezone, as `YYYY-MM-DD` — used
 * only to build the "Returns Today" dashboard shortcut's `createdFrom`/
 * `createdTo` query values. The backend remains the sole authority for
 * converting this local date into the actual UTC instant range
 * (`OperationalDayService`); this never computes a UTC boundary itself.
 */
export function todaySydneyDate(): string {
  return sydneyDateFormatter.format(new Date());
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function firstDayOfIsoMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

const sydneyTimestampFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: OPERATIONAL_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** e.g. "2 Aug 2026, 11:15 am" in Australia/Sydney, regardless of the browser's own timezone. */
export function formatSydneyTimestamp(isoTimestamp: string): string {
  return sydneyTimestampFormatter.format(new Date(isoTimestamp)).replace(/\s?(AM|PM)$/i, (match) => match.toLowerCase());
}
