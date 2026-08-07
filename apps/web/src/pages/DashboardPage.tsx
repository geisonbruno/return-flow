import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { toSafeErrorMessage } from '../api/problemDetail';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { ReturnTable } from '../components/ReturnTable';
import { SummaryCard } from '../components/SummaryCard';
import { EMPTY_FILTERS, filtersToSearchParams } from '../returns/filters';
import { useDashboardSummary, useLatestReturns } from '../returns/queries';
import { todaySydneyDate } from '../returns/sydneyDate';

const NOT_YET_OPERATIONAL_TEXT = 'Available with warehouse review';

export function DashboardPage() {
  useEffect(() => {
    document.title = 'ReturnFlow — Dashboard';
  }, []);

  const navigate = useNavigate();
  const summary = useDashboardSummary();
  const latestReturns = useLatestReturns();

  const goToWaitingWarehouse = () => {
    const params = filtersToSearchParams({ ...EMPTY_FILTERS, status: 'AWAITING_WAREHOUSE' });
    navigate(`/returns?${params.toString()}`);
  };

  const goToReturnsToday = () => {
    const today = todaySydneyDate();
    const params = filtersToSearchParams({ ...EMPTY_FILTERS, createdFrom: today, createdTo: today });
    navigate(`/returns?${params.toString()}`);
  };

  const handleRefresh = () => {
    void summary.refetch();
    void latestReturns.refetch();
  };

  return (
    <section className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <button type="button" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      {summary.isError ? (
        <ErrorState message={toSafeErrorMessage(summary.error, 'Unable to load the dashboard summary.')} onRetry={() => summary.refetch()} />
      ) : (
        <div className="summary-cards">
          <SummaryCard label="Waiting Warehouse" value={summary.data?.waitingWarehouse} loading={summary.isPending} onClick={goToWaitingWarehouse} />
          <SummaryCard
            label="In Review"
            value={summary.data?.inReview}
            loading={summary.isPending}
            disabled
            secondaryText={NOT_YET_OPERATIONAL_TEXT}
          />
          <SummaryCard
            label="Closed Today"
            value={summary.data?.closedToday}
            loading={summary.isPending}
            disabled
            secondaryText={NOT_YET_OPERATIONAL_TEXT}
          />
          <SummaryCard label="Returns Today" value={summary.data?.returnsToday} loading={summary.isPending} onClick={goToReturnsToday} />
        </div>
      )}

      <div className="dashboard-page__latest">
        <h2>Latest Returns</h2>
        {latestReturns.isPending ? (
          <LoadingState label="Loading latest returns…" />
        ) : latestReturns.isError ? (
          <ErrorState message={toSafeErrorMessage(latestReturns.error, 'Unable to load the latest returns.')} onRetry={() => latestReturns.refetch()} />
        ) : latestReturns.data.content.length === 0 ? (
          <p>No returns have been created yet.</p>
        ) : (
          <ReturnTable returns={latestReturns.data.content} compact />
        )}
      </div>
    </section>
  );
}
