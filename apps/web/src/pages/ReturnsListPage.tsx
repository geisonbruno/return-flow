import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { toSafeErrorMessage } from '../api/problemDetail';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { Pagination } from '../components/Pagination';
import { ReturnTable } from '../components/ReturnTable';
import {
  EMPTY_FILTERS,
  RETURNS_PAGE_SIZE,
  filtersToSearchParams,
  hasActiveFilters,
  isInvalidDateRange,
  parseReturnsFilters,
  type ReturnsFilters,
} from '../returns/filters';
import { useDriverOptions, useReturnsList, useRouteOptions } from '../returns/queries';
import { REASON_OPTIONS, STATUS_OPTIONS } from '../returns/returnOptions';

export function ReturnsListPage() {
  useEffect(() => {
    document.title = 'ReturnFlow — Returns';
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const filters = useMemo(() => parseReturnsFilters(searchParams), [searchParams]);

  // Uncommitted drafts for free-text/date inputs, so typing doesn't refetch
  // on every keystroke — only an explicit search submit or a date blur
  // commits a change to the URL (and therefore to the API request).
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [createdFromDraft, setCreatedFromDraft] = useState(filters.createdFrom);
  const [createdToDraft, setCreatedToDraft] = useState(filters.createdTo);

  useEffect(() => {
    setSearchDraft(filters.search);
    setCreatedFromDraft(filters.createdFrom);
    setCreatedToDraft(filters.createdTo);
  }, [filters.search, filters.createdFrom, filters.createdTo]);

  const driverOptions = useDriverOptions();
  const routeOptions = useRouteOptions();

  function applyFilters(next: Partial<ReturnsFilters>, resetPage = true) {
    const merged: ReturnsFilters = { ...filters, ...next, page: resetPage ? 0 : (next.page ?? filters.page) };
    setSearchParams(filtersToSearchParams(merged));
  }

  const returnsQuery = useReturnsList({
    page: filters.page,
    size: RETURNS_PAGE_SIZE,
    search: filters.search || undefined,
    status: filters.status || undefined,
    reason: filters.reason || undefined,
    createdFrom: filters.createdFrom || undefined,
    createdTo: filters.createdTo || undefined,
    driverId: filters.driverId || undefined,
    routeId: filters.routeId || undefined,
  });

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters({ search: searchDraft.trim() });
  };

  const draftDateRangeInvalid = isInvalidDateRange({ ...filters, createdFrom: createdFromDraft, createdTo: createdToDraft });

  const commitDateRange = () => {
    if (isInvalidDateRange({ ...filters, createdFrom: createdFromDraft, createdTo: createdToDraft })) {
      return;
    }
    if (createdFromDraft === filters.createdFrom && createdToDraft === filters.createdTo) {
      return;
    }
    applyFilters({ createdFrom: createdFromDraft, createdTo: createdToDraft });
  };

  const handleClearFilters = () => {
    setSearchParams(filtersToSearchParams(EMPTY_FILTERS));
  };

  const filtersActive = hasActiveFilters(filters);
  const page = returnsQuery.data;

  return (
    <section className="returns-page">
      <div className="page-header">
        <h1>Returns</h1>
        <button type="button" onClick={() => returnsQuery.refetch()}>
          Refresh
        </button>
      </div>

      <form className="returns-filters" onSubmit={handleSearchSubmit}>
        <div className="form-field returns-filters__search">
          <label htmlFor="returns-search">Search</label>
          <input
            id="returns-search"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Return #, customer, product, driver, route"
          />
        </div>
        <button type="submit">Search</button>

        <div className="form-field">
          <label htmlFor="returns-status">Status</label>
          <select id="returns-status" value={filters.status} onChange={(event) => applyFilters({ status: event.target.value as ReturnsFilters['status'] })}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="returns-reason">Reason</label>
          <select id="returns-reason" value={filters.reason} onChange={(event) => applyFilters({ reason: event.target.value as ReturnsFilters['reason'] })}>
            <option value="">All reasons</option>
            {REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="returns-driver">Driver</label>
          <select
            id="returns-driver"
            value={filters.driverId}
            onChange={(event) => applyFilters({ driverId: event.target.value })}
            disabled={driverOptions.isPending}
          >
            <option value="">All drivers</option>
            {(driverOptions.data ?? []).map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="returns-route">Route</label>
          <select id="returns-route" value={filters.routeId} onChange={(event) => applyFilters({ routeId: event.target.value })} disabled={routeOptions.isPending}>
            <option value="">All routes</option>
            {(routeOptions.data ?? []).map((route) => (
              <option key={route.id} value={route.id}>
                {route.code} — {route.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="returns-created-from">Created from</label>
          <input
            id="returns-created-from"
            type="date"
            value={createdFromDraft}
            onChange={(event) => setCreatedFromDraft(event.target.value)}
            onBlur={commitDateRange}
          />
        </div>
        <div className="form-field">
          <label htmlFor="returns-created-to">Created to</label>
          <input id="returns-created-to" type="date" value={createdToDraft} onChange={(event) => setCreatedToDraft(event.target.value)} onBlur={commitDateRange} />
        </div>

        <button type="button" onClick={handleClearFilters} disabled={!filtersActive && filters.page === 0}>
          Clear filters
        </button>
      </form>

      {draftDateRangeInvalid && <p className="error-message" role="alert">&quot;Created from&quot; must not be after &quot;Created to&quot;.</p>}

      {returnsQuery.isPending ? (
        <LoadingState label="Loading returns…" />
      ) : returnsQuery.isError ? (
        <ErrorState message={toSafeErrorMessage(returnsQuery.error, 'Unable to load returns.')} onRetry={() => returnsQuery.refetch()} />
      ) : page && page.content.length === 0 ? (
        filtersActive ? (
          <EmptyState
            message="No returns match the current filters."
            action={
              <button type="button" onClick={handleClearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState message="No returns have been created yet." />
        )
      ) : page ? (
        <>
          <ReturnTable returns={page.content} backTo={`${location.pathname}${location.search}`} />
          <Pagination page={page.page} totalPages={page.totalPages} totalElements={page.totalElements} onPageChange={(nextPage) => applyFilters({ page: nextPage }, false)} />
        </>
      ) : null}
    </section>
  );
}
