import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, filtersToSearchParams, hasActiveFilters, isInvalidDateRange, isValidUuid, parseReturnsFilters, type ReturnsFilters } from './filters';

describe('isValidUuid', () => {
  it('accepts a well-formed UUID', () => {
    expect(isValidUuid('11111111-1111-1111-1111-111111111111')).toBe(true);
  });

  it('rejects a malformed value', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('12345')).toBe(false);
    expect(isValidUuid('')).toBe(false);
  });
});

describe('parseReturnsFilters', () => {
  it('defaults every field when the URL has no query string', () => {
    expect(parseReturnsFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it('parses every supported field', () => {
    const params = new URLSearchParams({
      page: '2',
      search: 'acme',
      status: 'AWAITING_WAREHOUSE',
      reason: 'DAMAGED',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      driverId: '11111111-1111-1111-1111-111111111111',
      routeId: '22222222-2222-2222-2222-222222222222',
    });

    expect(parseReturnsFilters(params)).toEqual({
      page: 2,
      search: 'acme',
      status: 'AWAITING_WAREHOUSE',
      reason: 'DAMAGED',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      driverId: '11111111-1111-1111-1111-111111111111',
      routeId: '22222222-2222-2222-2222-222222222222',
    });
  });

  it('falls back to defaults for an unknown/invalid status instead of passing it through', () => {
    const params = new URLSearchParams({ status: 'IN_REVIEW' });
    expect(parseReturnsFilters(params).status).toBe('');
  });

  it('falls back to defaults for an unknown reason', () => {
    const params = new URLSearchParams({ reason: 'NOT_A_REAL_REASON' });
    expect(parseReturnsFilters(params).reason).toBe('');
  });

  it('rejects a malformed date instead of forwarding it to the API', () => {
    const params = new URLSearchParams({ createdFrom: 'not-a-date' });
    expect(parseReturnsFilters(params).createdFrom).toBe('');
  });

  it('rejects a malformed UUID for driverId/routeId', () => {
    const params = new URLSearchParams({ driverId: 'not-a-uuid', routeId: '12345' });
    const result = parseReturnsFilters(params);
    expect(result.driverId).toBe('');
    expect(result.routeId).toBe('');
  });

  it('rejects a negative or non-numeric page, falling back to 0', () => {
    expect(parseReturnsFilters(new URLSearchParams({ page: '-1' })).page).toBe(0);
    expect(parseReturnsFilters(new URLSearchParams({ page: 'abc' })).page).toBe(0);
  });

  it('never crashes on a page with no recognizable values at all', () => {
    const params = new URLSearchParams({ foo: 'bar', page: 'DROP TABLE returns' });
    expect(() => parseReturnsFilters(params)).not.toThrow();
    expect(parseReturnsFilters(params)).toEqual(EMPTY_FILTERS);
  });
});

describe('filtersToSearchParams', () => {
  it('omits page=0 and every empty field to keep the URL free of noise', () => {
    const params = filtersToSearchParams(EMPTY_FILTERS);
    expect(params.toString()).toBe('');
  });

  it('round-trips through parseReturnsFilters', () => {
    const filters: ReturnsFilters = {
      page: 3,
      search: 'acme',
      status: 'AWAITING_WAREHOUSE',
      reason: 'DAMAGED',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      driverId: '11111111-1111-1111-1111-111111111111',
      routeId: '22222222-2222-2222-2222-222222222222',
    };
    expect(parseReturnsFilters(filtersToSearchParams(filters))).toEqual(filters);
  });

  it('never includes a token, tenant ID, or other server-internal value — only the fields ReturnsFilters actually declares', () => {
    const params = filtersToSearchParams({ ...EMPTY_FILTERS, search: 'acme' });
    expect([...params.keys()]).toEqual(['search']);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the empty filter state', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('is true when any single field is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: 'acme' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, status: 'AWAITING_WAREHOUSE' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, driverId: '11111111-1111-1111-1111-111111111111' })).toBe(true);
  });

  it('is unaffected by page alone', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, page: 4 })).toBe(false);
  });
});

describe('isInvalidDateRange', () => {
  it('is false when either date is missing', () => {
    expect(isInvalidDateRange(EMPTY_FILTERS)).toBe(false);
    expect(isInvalidDateRange({ ...EMPTY_FILTERS, createdFrom: '2026-01-01' })).toBe(false);
  });

  it('is false for a valid range', () => {
    expect(isInvalidDateRange({ ...EMPTY_FILTERS, createdFrom: '2026-01-01', createdTo: '2026-01-31' })).toBe(false);
  });

  it('is true when createdFrom is after createdTo', () => {
    expect(isInvalidDateRange({ ...EMPTY_FILTERS, createdFrom: '2026-02-01', createdTo: '2026-01-01' })).toBe(true);
  });

  it('is false when the dates are equal', () => {
    expect(isInvalidDateRange({ ...EMPTY_FILTERS, createdFrom: '2026-01-01', createdTo: '2026-01-01' })).toBe(false);
  });
});
