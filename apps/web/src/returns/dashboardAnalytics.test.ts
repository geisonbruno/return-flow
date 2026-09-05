import { describe, expect, it } from 'vitest';
import { reasonDistributionView, resolveAnalyticsRange } from './dashboardAnalytics';

describe('dashboard analytics model', () => {
  it('resolves Last 7 days inclusively', () => expect(resolveAnalyticsRange('LAST_7_DAYS', '', '', '2026-09-01')).toEqual({ from: '2026-08-26', to: '2026-09-01', error: null }));
  it('resolves Last 30 days inclusively', () => expect(resolveAnalyticsRange('LAST_30_DAYS', '', '', '2026-09-01')).toEqual({ from: '2026-08-03', to: '2026-09-01', error: null }));
  it('resolves This month from the first day', () => expect(resolveAnalyticsRange('THIS_MONTH', '', '', '2026-09-01')).toEqual({ from: '2026-09-01', to: '2026-09-01', error: null }));
  it('accepts a valid custom range', () => expect(resolveAnalyticsRange('CUSTOM', '2026-08-01', '2026-08-12', '2026-09-01')).toEqual({ from: '2026-08-01', to: '2026-08-12', error: null }));
  it('maps reason labels and percentages from real counts', () => expect(reasonDistributionView([{ reason: 'DAMAGED', count: 3 }, { reason: 'LEAKING', count: 1 }])).toEqual([{ reason: 'DAMAGED', count: 3, label: 'Damaged', percentage: 75 }, { reason: 'LEAKING', count: 1, label: 'Leaking', percentage: 25 }]));
});
