import { useEffect, useMemo, useState } from 'react';

import { useAdminRoutes, useCreateRoute, useUpdateRoute } from '../admin/queries';
import type { AdminRoute } from '../admin/types';
import { toSafeErrorMessage } from '../api/problemDetail';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Icon } from '../components/Icon';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import './RoutesPage.css';

/** Mirrors the backend's `@Size(max = 50)` / `@Size(max = 255)` on the route DTOs — client-side feedback only; the backend re-validates. */
const CODE_MAX_LENGTH = 50;
const NAME_MAX_LENGTH = 255;

interface RouteFormState {
  code: string;
  name: string;
  active: boolean;
}

const EMPTY_ROUTE_FORM: RouteFormState = { code: '', name: '', active: true };

/**
 * Only `code` is required — the backend's `CreateRouteRequest.name` carries
 * `@Size` but not `@NotBlank`, so a nameless route is genuinely valid and
 * this form must not invent a stricter rule.
 */
function validateRouteForm(form: RouteFormState): string | null {
  if (!form.code.trim()) {
    return 'Code is required.';
  }
  if (form.code.trim().length > CODE_MAX_LENGTH) {
    return `Code must be at most ${CODE_MAX_LENGTH} characters.`;
  }
  if (form.name.trim().length > NAME_MAX_LENGTH) {
    return `Name must be at most ${NAME_MAX_LENGTH} characters.`;
  }
  return null;
}

/** An omitted name is sent as `null`, never as an empty string, so the stored value stays genuinely absent. */
function toNamePayload(name: string): string | null {
  return name.trim() ? name.trim() : null;
}

export function RoutesPage() {
  useEffect(() => {
    document.title = 'ReturnFlow — Routes';
  }, []);

  const routesQuery = useAdminRoutes();
  const createRouteMutation = useCreateRoute();
  const updateRouteMutation = useUpdateRoute();

  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RouteFormState>(EMPTY_ROUTE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingRoute, setEditingRoute] = useState<AdminRoute | null>(null);
  const [editForm, setEditForm] = useState<RouteFormState>(EMPTY_ROUTE_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);

  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);

  /** Purely local narrowing of the already-loaded list — the route query itself is never re-issued with a search term. */
  const visibleRoutes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return routes;
    }
    return routes.filter(
      (route) => route.code.toLowerCase().includes(term) || (route.name?.toLowerCase().includes(term) ?? false),
    );
  }, [routes, search]);

  // Counts describe the complete loaded population, never the searched rows.
  const routeCounts = routesQuery.isSuccess
    ? {
        total: routes.length,
        active: routes.filter((route) => route.active === true).length,
        inactive: routes.filter((route) => route.active === false).length,
      }
    : null;

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setCreateForm(EMPTY_ROUTE_FORM);
    setCreateError(null);
  };

  const closeEditDialog = () => {
    setEditingRoute(null);
    setEditError(null);
    setDeactivateConfirmOpen(false);
  };

  const handleOpenCreate = () => {
    setFeedback(null);
    setCreateForm(EMPTY_ROUTE_FORM);
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleOpenEdit = (route: AdminRoute) => {
    setFeedback(null);
    setEditingRoute(route);
    setEditForm({ code: route.code, name: route.name ?? '', active: route.active });
    setEditError(null);
  };

  const handleCreate = () => {
    const validationError = validateRouteForm(createForm);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreateError(null);
    createRouteMutation.mutate(
      { code: createForm.code.trim(), name: toNamePayload(createForm.name) },
      {
        onSuccess: (created) => {
          setFeedback(`Route "${created.code}" was created.`);
          closeCreateDialog();
        },
        onError: (error) => setCreateError(toSafeErrorMessage(error, 'Unable to create this route.')),
      },
    );
  };

  const submitEdit = () => {
    if (!editingRoute) {
      return;
    }
    setEditError(null);
    updateRouteMutation.mutate(
      {
        routeId: editingRoute.id,
        // A full replace: every field the backend's PUT contract requires.
        payload: { code: editForm.code.trim(), name: toNamePayload(editForm.name), active: editForm.active },
      },
      {
        onSuccess: (updated) => {
          setFeedback(`Route "${updated.code}" was updated.`);
          closeEditDialog();
        },
        onError: (error) => {
          // The dependency conflict (a route still assigned to an active
          // driver) lands here. The edit form deliberately stays open with
          // the ADMIN's values intact — resolving it means reassigning those
          // drivers deliberately, never silently changing them from here.
          setDeactivateConfirmOpen(false);
          setEditError(toSafeErrorMessage(error, 'Unable to update this route.'));
        },
      },
    );
  };

  const handleEditSave = () => {
    const validationError = validateRouteForm(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }
    if (editingRoute?.active && !editForm.active) {
      setEditError(null);
      setDeactivateConfirmOpen(true);
      return;
    }
    submitEdit();
  };

  return (
    <section className="admin-page routes-page">
      <header className="compact-page-header routes-page__header">
        <div>
          <h1>Routes</h1>
          <p>Manage delivery routes</p>
        </div>
        <button className="routes-page__create" type="button" onClick={handleOpenCreate}>
          <span aria-hidden="true">+</span> Create route
        </button>
      </header>

      {routeCounts && (
        <section className="routes-summary" aria-label="Route summary">
          {([
            { key: 'total', label: 'Total routes', count: routeCounts.total },
            { key: 'active', label: 'Active routes', count: routeCounts.active },
            { key: 'inactive', label: 'Inactive routes', count: routeCounts.inactive },
          ] as const).map((card) => (
            <article className={`routes-summary__card routes-summary__card--${card.key}`} key={card.key} aria-labelledby={`routes-summary-${card.key}`}>
              <span className="routes-summary__icon">
                {card.key === 'total' ? (
                  <Icon name="routes" />
                ) : card.key === 'active' ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="7" y="5" width="3.5" height="14" rx="1" />
                    <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
                  </svg>
                )}
              </span>
              <div>
                <h2 id={`routes-summary-${card.key}`}>{card.label}</h2>
                <p>{card.count}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      {feedback && (
        <p className="form-success" role="status">
          {feedback}
        </p>
      )}

      <div className="routes-search">
        <div className="form-field routes-search__field">
          <label className="sr-only" htmlFor="routes-search">Search routes</label>
          <svg className="routes-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="7" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            id="routes-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by route name or code"
          />
        </div>
      </div>

      {routesQuery.isPending ? (
        <LoadingState label="Loading routes…" />
      ) : routesQuery.isError ? (
        <ErrorState message={toSafeErrorMessage(routesQuery.error, 'Unable to load routes.')} onRetry={() => routesQuery.refetch()} />
      ) : visibleRoutes.length === 0 ? (
        <EmptyState message={routes.length === 0 ? 'No routes have been created yet.' : 'No routes match the current search.'} />
      ) : (
        <div className="return-table-wrapper">
          <table className="return-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoutes.map((route) => (
                <tr key={route.id}>
                  <td>{route.code}</td>
                  <td>{route.name || '—'}</td>
                  <td>
                    <span className={`routes-status routes-status--${route.active ? 'active' : 'inactive'}`}>
                      <StatusBadge label={route.active ? 'Active' : 'Inactive'} />
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button type="button" className="secondary-button" onClick={() => handleOpenEdit(route)}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="routes-table__count" role="status">
            Showing {visibleRoutes.length} of {routes.length} {routes.length === 1 ? 'route' : 'routes'}
          </p>
        </div>
      )}

      {createOpen && (
        <ConfirmDialog
          title="Create route"
          message="New routes are created active. The code is stored in upper case."
          confirmLabel="Create route"
          onConfirm={handleCreate}
          onCancel={closeCreateDialog}
          confirmDisabled={createRouteMutation.isPending}
          dismissOnBackdropClick={false}
        >
          <div className="admin-form">
            {createError && (
              <p className="field-error" role="alert">
                {createError}
              </p>
            )}
            <div className="form-field">
              <label htmlFor="create-route-code">Code</label>
              <input
                id="create-route-code"
                type="text"
                value={createForm.code}
                maxLength={CODE_MAX_LENGTH}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="create-route-name">Name (optional)</label>
              <input
                id="create-route-name"
                type="text"
                value={createForm.name}
                maxLength={NAME_MAX_LENGTH}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
          </div>
        </ConfirmDialog>
      )}

      {editingRoute && !deactivateConfirmOpen && (
        <ConfirmDialog
          title={`Edit route ${editingRoute.code}`}
          message="Saving replaces this route's current details."
          confirmLabel="Save changes"
          onConfirm={handleEditSave}
          onCancel={closeEditDialog}
          confirmDisabled={updateRouteMutation.isPending}
          dismissOnBackdropClick={false}
        >
          <div className="admin-form">
            {editError && (
              <p className="field-error" role="alert">
                {editError}
              </p>
            )}
            <div className="form-field">
              <label htmlFor="edit-route-code">Code</label>
              <input
                id="edit-route-code"
                type="text"
                value={editForm.code}
                maxLength={CODE_MAX_LENGTH}
                onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-route-name">Name (optional)</label>
              <input
                id="edit-route-name"
                type="text"
                value={editForm.name}
                maxLength={NAME_MAX_LENGTH}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Active
              </label>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {editingRoute && deactivateConfirmOpen && (
        <ConfirmDialog
          title={`Deactivate route ${editingRoute.code}?`}
          message="An inactive route cannot be assigned to a driver. Deactivation is not deletion — the route remains and can be reactivated later. If it is still assigned to an active driver, the backend will reject this."
          confirmLabel="Deactivate route"
          cancelLabel="Keep active"
          onConfirm={submitEdit}
          onCancel={() => setDeactivateConfirmOpen(false)}
          confirmDisabled={updateRouteMutation.isPending}
        />
      )}
    </section>
  );
}
