import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatSydneyTimestamp, todaySydneyDate } from './sydneyDate';

describe('todaySydneyDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM-DD', () => {
    expect(todaySydneyDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses the Australia/Sydney calendar date, not the system/browser-local date', () => {
    // 2026-01-01 10:00 UTC is already 2026-01-01 21:00 in Sydney (UTC+11
    // during Australian daylight saving) — same date here, so instead pick
    // an instant where UTC and Sydney genuinely disagree on the calendar day.
    vi.useFakeTimers({ toFake: ['Date'] });
    // 2026-01-01 23:30 UTC = 2026-01-02 10:30 in Sydney (UTC+11).
    vi.setSystemTime(new Date('2026-01-01T23:30:00Z'));
    expect(todaySydneyDate()).toBe('2026-01-02');
  });
});

describe('formatSydneyTimestamp', () => {
  it('formats using the Australia/Sydney timezone regardless of the instant given', () => {
    // 2026-08-06T02:15:00Z = 2026-08-06 12:15pm in Sydney (UTC+10 in August, outside DST).
    const formatted = formatSydneyTimestamp('2026-08-06T02:15:00Z');
    expect(formatted).toContain('6 Aug 2026');
    expect(formatted).toContain('12:15');
    expect(formatted.toLowerCase()).toContain('pm');
  });
});
