import { formatDateTime, formatQuantityAndUnit, REASON_LABELS, REASON_OPTIONS, STATUS_LABELS, UNIT_LABELS, UNIT_OPTIONS } from './returnOptions';
import type { ReturnReason } from './types';

const CANONICAL_REASONS: ReturnReason[] = [
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

describe('REASON_LABELS', () => {
  it('has a readable label for every canonical CLAUDE.md reason value', () => {
    for (const reason of CANONICAL_REASONS) {
      expect(REASON_LABELS[reason]).toEqual(expect.any(String));
      expect(REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
  });

  it('exposes exactly the eleven canonical reasons and no temporary Phase 3B names', () => {
    const keys = Object.keys(REASON_LABELS).sort();
    expect(keys).toEqual([...CANONICAL_REASONS].sort());
    expect(keys).not.toContain('DELIVERED_WRONG');
    expect(keys).not.toContain('EXTRA');
    expect(keys).not.toContain('MISSING');
    expect(keys).not.toContain('NEEDS_CHARGE');
    expect(keys).not.toContain('NOT_NEEDED');
    expect(keys).not.toContain('WRONG_ORDER');
    expect(keys).not.toContain('EXCHANGE');
  });

  it('never displays a raw enum code as a label', () => {
    for (const reason of CANONICAL_REASONS) {
      expect(REASON_LABELS[reason]).not.toBe(reason);
    }
  });

  it('REASON_OPTIONS carries the same labels in the canonical order', () => {
    expect(REASON_OPTIONS.map((option) => option.value)).toEqual(CANONICAL_REASONS);
  });
});

describe('UNIT_LABELS', () => {
  it('CTN displays as Carton', () => {
    expect(UNIT_LABELS.CTN).toBe('Carton');
  });

  it('EA displays as Each', () => {
    expect(UNIT_LABELS.EA).toBe('Each');
  });

  it('exposes exactly CTN and EA — no CT and no other unit', () => {
    expect(Object.keys(UNIT_LABELS).sort()).toEqual(['CTN', 'EA']);
    expect(UNIT_OPTIONS.map((option) => option.value).sort()).toEqual(['CTN', 'EA']);
  });
});

describe('STATUS_LABELS', () => {
  it('AWAITING_WAREHOUSE has a readable label', () => {
    expect(STATUS_LABELS.AWAITING_WAREHOUSE).toBe('Awaiting warehouse');
  });
});

describe('formatQuantityAndUnit', () => {
  it('formats a carton quantity compactly', () => {
    expect(formatQuantityAndUnit(3, 'CTN')).toBe('3 CTN');
  });

  it('formats an each quantity compactly', () => {
    expect(formatQuantityAndUnit(12, 'EA')).toBe('12 EA');
  });
});

describe('formatDateTime', () => {
  it('never exposes the raw ISO timestamp as the formatted output', () => {
    const iso = '2026-08-02T01:15:00.000Z';
    expect(formatDateTime(iso)).not.toBe(iso);
  });

  it('includes a readable year and time-of-day marker', () => {
    const formatted = formatDateTime('2026-08-02T01:15:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/am|pm/);
  });
});
