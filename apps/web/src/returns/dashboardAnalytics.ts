import { firstDayOfIsoMonth, shiftIsoDate, todaySydneyDate } from './sydneyDate';
import { REASON_LABELS } from './returnOptions';
import type { DashboardReasonDistribution } from './types';

export type AnalyticsPeriod = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'CUSTOM';

export interface AnalyticsRange {
  from: string | null;
  to: string | null;
  error: string | null;
}

export function resolveAnalyticsRange(
  period: AnalyticsPeriod,
  customFrom = '',
  customTo = '',
  today = todaySydneyDate(),
): AnalyticsRange {
  if (period === 'LAST_7_DAYS') return { from: shiftIsoDate(today, -6), to: today, error: null };
  if (period === 'LAST_30_DAYS') return { from: shiftIsoDate(today, -29), to: today, error: null };
  if (period === 'THIS_MONTH') return { from: firstDayOfIsoMonth(today), to: today, error: null };
  if (!customFrom || !customTo) return { from: null, to: null, error: 'Choose both From and To dates.' };
  if (customFrom > customTo) return { from: null, to: null, error: 'From date must be on or before To date.' };
  return { from: customFrom, to: customTo, error: null };
}

export function reasonDistributionView(items: DashboardReasonDistribution[]) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return items.map((item) => ({
    ...item,
    label: REASON_LABELS[item.reason],
    percentage: total === 0 ? 0 : (item.count / total) * 100,
  }));
}
