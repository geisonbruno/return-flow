import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toSafeErrorMessage } from '../api/problemDetail';
import { DashboardAnalytics } from '../components/DashboardAnalytics';
import { DashboardRecentReturns } from '../components/DashboardRecentReturns';
import { ErrorState } from '../components/ErrorState';
import { Icon } from '../components/Icon';
import { LoadingState } from '../components/LoadingState';
import { SummaryCard } from '../components/SummaryCard';
import { resolveAnalyticsRange, type AnalyticsPeriod } from '../returns/dashboardAnalytics';
import { EMPTY_FILTERS, filtersToSearchParams } from '../returns/filters';
import { useDashboardAnalytics, useDashboardSummary, useLatestReturns } from '../returns/queries';
import { todaySydneyDate } from '../returns/sydneyDate';

export function DashboardPage() {
  useEffect(() => { document.title = 'ReturnFlow — Dashboard'; }, []);
  const navigate = useNavigate();
  const [period, setPeriod] = useState<AnalyticsPeriod>('LAST_30_DAYS');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const range = useMemo(() => resolveAnalyticsRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const summary = useDashboardSummary();
  const latestReturns = useLatestReturns();
  const analytics = useDashboardAnalytics(range.from, range.to);

  const goToWaitingWarehouse = () => navigate(`/returns?${filtersToSearchParams({ ...EMPTY_FILTERS, status: 'AWAITING_WAREHOUSE' })}`);
  const goToInReview = () => navigate(`/returns?${filtersToSearchParams({ ...EMPTY_FILTERS, status: 'IN_REVIEW' })}`);
  const goToClosedToday = () => { const today = todaySydneyDate(); navigate(`/returns?${filtersToSearchParams({ ...EMPTY_FILTERS, status: 'CLOSED', closedFrom: today, closedTo: today })}`); };
  const goToReturnsToday = () => { const today = todaySydneyDate(); navigate(`/returns?${filtersToSearchParams({ ...EMPTY_FILTERS, createdFrom: today, createdTo: today })}`); };
  const handleRefresh = () => { void summary.refetch(); void latestReturns.refetch(); if (range.from && range.to) void analytics.refetch(); };

  return <section className="dashboard-page">
    <div className="dashboard-header"><div><h1>Dashboard</h1></div><button type="button" className="dashboard-refresh" onClick={handleRefresh}><Icon name="refresh"/>Refresh</button></div>
    {summary.isError ? <ErrorState message={toSafeErrorMessage(summary.error, 'Unable to load the dashboard summary.')} onRetry={() => summary.refetch()} /> : <div className="summary-cards">
      <SummaryCard label="Waiting Warehouse" value={summary.data?.waitingWarehouse} loading={summary.isPending} onClick={goToWaitingWarehouse} tone="green" icon={<Icon name="warehouse"/>}/>
      <SummaryCard label="In Review" value={summary.data?.inReview} loading={summary.isPending} onClick={goToInReview} tone="blue" icon={<Icon name="review"/>}/>
      <SummaryCard label="Closed Today" value={summary.data?.closedToday} loading={summary.isPending} onClick={goToClosedToday} tone="amber" icon={<Icon name="closed"/>}/>
      <SummaryCard label="Returns Today" value={summary.data?.returnsToday} loading={summary.isPending} onClick={goToReturnsToday} tone="purple" icon={<Icon name="today"/>}/>
    </div>}

    <section className="dashboard-analytics" aria-label="Return analytics">
      <div className="dashboard-analytics__controls">
        <label className="period-select"><span>Period</span><select value={period} onChange={(event) => setPeriod(event.target.value as AnalyticsPeriod)}><option value="LAST_7_DAYS">Last 7 days</option><option value="LAST_30_DAYS">Last 30 days</option><option value="THIS_MONTH">This month</option><option value="CUSTOM">Custom range</option></select></label>
        {period === 'CUSTOM' && <div className="custom-range"><label><span>From</span><input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)}/></label><label><span>To</span><input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)}/></label>{range.error && <p role="alert">{range.error}</p>}</div>}
      </div>
      {range.from && range.to && (analytics.isPending ? <LoadingState label="Loading return analytics…"/> : analytics.isError ? <ErrorState message={toSafeErrorMessage(analytics.error, 'Unable to load return analytics.')} onRetry={() => analytics.refetch()}/> : analytics.data ? <DashboardAnalytics data={analytics.data}/> : null)}
    </section>

    <section className="dashboard-recent"><div className="dashboard-recent__heading"><h2>Recent Returns</h2><Link to="/returns">View all returns</Link></div>
      {latestReturns.isPending ? (
        <LoadingState label="Loading recent returns…"/>
      ) : latestReturns.isError ? (
        <ErrorState message={toSafeErrorMessage(latestReturns.error, 'Unable to load recent returns.')} onRetry={() => latestReturns.refetch()}/>
      ) : latestReturns.data.content.length === 0 ? (
        <p className="dashboard-recent__empty">No returns have been created yet.</p>
      ) : (
        <DashboardRecentReturns returns={latestReturns.data.content}/>
      )}
    </section>
  </section>;
}
