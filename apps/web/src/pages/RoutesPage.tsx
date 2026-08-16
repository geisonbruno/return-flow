import { useEffect, useMemo, useState } from 'react';

import { useAdminRoutes, useCreateRoute, useUpdateRoute } from '../admin/queries';
import type { AdminRoute } from '../admin/types';
import { toSafeErrorMessage } from '../api/problemDetail';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';

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

  const [feedback, setFeedback] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RouteFormState>(EMPTY_ROUTE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingRoute, setEditingRoute] = useState<AdminRoute | null>(null);
  const [editForm, setEditForm] = useState<RouteFormState>(EMPTY_ROUTE_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);

  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);

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
    <section className="admin-page">
      <div className="page-header">
        <h1>Routes</h1>
        <button type="button" onClick={handleOpenCreate}>
          Create route
        </button>
      </div>

      {feedback && (
        <p className="form-success" role="status">
          {feedback}
        </p>
      )}

      {routesQuery.isPending ? (
        <LoadingState label="Loading routes…" />
      ) : routesQuery.isError ? (
        <ErrorState message={toSafeErrorMessage(routesQuery.error, 'Unable to load routes.')} onRetry={() => routesQuery.refetch()} />
      ) : routes.length === 0 ? (
        <EmptyState message="No routes have been created yet." />
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
              {routes.map((route) => (
                <tr key={route.id}>
                  <td>{route.code}</td>
                  <td>{route.name || '—'}</td>
                  <td>
                    <StatusBadge label={route.active ? 'Active' : 'Inactive'} />
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
