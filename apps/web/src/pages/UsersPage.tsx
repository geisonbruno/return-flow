import { useEffect, useMemo, useState } from 'react';

import { useAdminRoutes, useAdminUsers, useCreateUser, useResetUserPassword, useUpdateUser } from '../admin/queries';
import type { AdminRoute, AdminUser, AdminUserRole } from '../admin/types';
import { toSafeErrorMessage } from '../api/problemDetail';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';

/**
 * Mirrors the backend's `@Size(min = 8)` on both `CreateUserRequest.password`
 * and `ResetPasswordRequest.newPassword` — client-side feedback only; the
 * backend re-validates independently and stays authoritative.
 */
const PASSWORD_MIN_LENGTH = 8;

const SELF_PROTECTION_NOTE = 'You cannot change your own role or deactivate your own account.';

/**
 * A deliberately loose shape check standing in for the backend's `@Email`,
 * not an attempt to fully validate an address. It exists so an obviously
 * malformed entry is caught here in the product's own English wording: the
 * backend's generic Bean Validation messages are emitted in the JVM's
 * default locale, which is not guaranteed to be English.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function roleLabel(role: AdminUserRole): string {
  return role === 'ADMIN' ? 'Admin' : 'Driver';
}

function routeLabel(route: { code: string; name: string | null } | null): string {
  if (!route) {
    return '—';
  }
  return route.name ? `${route.code} — ${route.name}` : route.code;
}

/**
 * Only ACTIVE routes are assignable — `UserAdminService.validateRouteAssignment`
 * rejects an inactive one outright. The single exception is a DRIVER whose
 * already-assigned route has since been deactivated: that route stays listed
 * (labelled inactive) so the form shows the user's real current state rather
 * than silently swapping in a different route behind the ADMIN's back.
 */
function assignableRoutes(routes: AdminRoute[], currentRouteId: string | null): AdminRoute[] {
  return routes.filter((route) => route.active || route.id === currentRouteId);
}

function routeOptionLabel(route: AdminRoute): string {
  const base = route.name ? `${route.code} — ${route.name}` : route.code;
  return route.active ? base : `${base} (inactive)`;
}

interface UserFormState {
  name: string;
  email: string;
  role: AdminUserRole;
  routeId: string;
  password: string;
  active: boolean;
}

const EMPTY_CREATE_FORM: UserFormState = { name: '', email: '', role: 'DRIVER', routeId: '', password: '', active: true };

/**
 * Client-side mirror of the backend's own rules, for immediate feedback
 * only. An ADMIN must have no route; a DRIVER needs one whenever the
 * resulting user will be active (an inactive DRIVER may be left without
 * one) — exactly `UserAdminService.validateRouteAssignment`'s logic.
 */
function validateUserForm(form: UserFormState, requirePassword: boolean): string | null {
  if (!form.name.trim()) {
    return 'Name is required.';
  }
  if (!form.email.trim()) {
    return 'Email is required.';
  }
  if (!EMAIL_SHAPE.test(form.email.trim())) {
    return 'Enter a valid email address.';
  }
  if (requirePassword && form.password.length < PASSWORD_MIN_LENGTH) {
    return `Temporary password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (form.role === 'DRIVER' && form.active && !form.routeId) {
    return 'An active driver requires a route.';
  }
  return null;
}

export function UsersPage() {
  useEffect(() => {
    document.title = 'ReturnFlow — Users';
  }, []);

  const { user: currentUser } = useAuth();
  const usersQuery = useAdminUsers();
  const routesQuery = useAdminRoutes();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const resetPasswordMutation = useResetUserPassword();

  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(EMPTY_CREATE_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);

  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);

  const visibleUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return users;
    }
    return users.filter((user) => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term));
  }, [usersQuery.data, search]);

  /** Every sensitive value this page holds is cleared here — nothing typed into a password field outlives its own dialog. */
  const closeCreateDialog = () => {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError(null);
    setShowCreatePassword(false);
  };

  const closeResetDialog = () => {
    setResetUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setResetError(null);
    setShowResetPassword(false);
  };

  const closeEditDialog = () => {
    setEditingUser(null);
    setEditError(null);
    setDeactivateConfirmOpen(false);
  };

  const handleOpenCreate = () => {
    setFeedback(null);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleOpenEdit = (user: AdminUser) => {
    setFeedback(null);
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      routeId: user.route?.id ?? '',
      password: '',
      active: user.active,
    });
    setEditError(null);
  };

  const handleOpenReset = (user: AdminUser) => {
    setFeedback(null);
    setResetUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setResetError(null);
  };

  const handleCreate = () => {
    const validationError = validateUserForm(createForm, true);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreateError(null);
    createUserMutation.mutate(
      {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        // An ADMIN must not carry a route at all — the field is never sent,
        // rather than sent as null, matching the backend's own expectation.
        ...(createForm.role === 'DRIVER' ? { routeId: createForm.routeId } : {}),
      },
      {
        onSuccess: (created) => {
          setFeedback(`User "${created.name}" was created.`);
          closeCreateDialog();
        },
        onError: (error) => setCreateError(toSafeErrorMessage(error, 'Unable to create this user.')),
      },
    );
  };

  const submitEdit = () => {
    if (!editingUser) {
      return;
    }
    setEditError(null);
    updateUserMutation.mutate(
      {
        userId: editingUser.id,
        // A full replace: every field the backend's PUT contract requires is
        // always sent, never a partial patch.
        payload: {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          role: editForm.role,
          routeId: editForm.role === 'DRIVER' ? editForm.routeId || null : null,
          active: editForm.active,
        },
      },
      {
        onSuccess: (updated) => {
          setFeedback(`User "${updated.name}" was updated.`);
          closeEditDialog();
        },
        onError: (error) => {
          setDeactivateConfirmOpen(false);
          setEditError(toSafeErrorMessage(error, 'Unable to update this user.'));
        },
      },
    );
  };

  const handleEditSave = () => {
    const validationError = validateUserForm(editForm, false);
    if (validationError) {
      setEditError(validationError);
      return;
    }
    // Only an active → inactive transition is destructive-feeling enough to
    // confirm; ordinary name/email/route edits and reactivation save directly.
    if (editingUser?.active && !editForm.active) {
      setEditError(null);
      setDeactivateConfirmOpen(true);
      return;
    }
    submitEdit();
  };

  const handleResetPassword = () => {
    if (!resetUser) {
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setResetError(`New password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('The two passwords do not match.');
      return;
    }
    setResetError(null);
    const targetName = resetUser.name;
    resetPasswordMutation.mutate(
      { userId: resetUser.id, newPassword },
      {
        onSuccess: () => {
          // Deliberately never echoes the new password back into the UI.
          setFeedback(`Password reset for "${targetName}".`);
          closeResetDialog();
        },
        onError: (error) => setResetError(toSafeErrorMessage(error, 'Unable to reset this password.')),
      },
    );
  };

  const editingSelf = Boolean(editingUser && currentUser && editingUser.id === currentUser.userId);

  return (
    <section className="admin-page">
      <div className="page-header">
        <h1>Users</h1>
        <button type="button" onClick={handleOpenCreate}>
          Create user
        </button>
      </div>

      {feedback && (
        <p className="form-success" role="status">
          {feedback}
        </p>
      )}

      <div className="admin-toolbar">
        <div className="form-field">
          <label htmlFor="users-search">Search</label>
          <input
            id="users-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or email"
          />
        </div>
      </div>

      {usersQuery.isPending ? (
        <LoadingState label="Loading users…" />
      ) : usersQuery.isError ? (
        <ErrorState message={toSafeErrorMessage(usersQuery.error, 'Unable to load users.')} onRetry={() => usersQuery.refetch()} />
      ) : visibleUsers.length === 0 ? (
        <EmptyState message={search.trim() ? 'No users match this search.' : 'No users have been created yet.'} />
      ) : (
        <div className="return-table-wrapper">
          <table className="return-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Route</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{roleLabel(user.role)}</td>
                  {/* An ADMIN never has a route — a neutral dash, not a blank cell. */}
                  <td>{user.role === 'ADMIN' ? '—' : routeLabel(user.route)}</td>
                  <td>
                    <StatusBadge label={user.active ? 'Active' : 'Inactive'} />
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button type="button" className="secondary-button" onClick={() => handleOpenEdit(user)}>
                        Edit
                      </button>
                      <button type="button" className="secondary-button" onClick={() => handleOpenReset(user)}>
                        Reset password
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
          title="Create user"
          message="New users are created active. A driver must be assigned an active route."
          confirmLabel="Create user"
          onConfirm={handleCreate}
          onCancel={closeCreateDialog}
          confirmDisabled={createUserMutation.isPending}
          dismissOnBackdropClick={false}
        >
          <div className="admin-form">
            {createError && (
              <p className="field-error" role="alert">
                {createError}
              </p>
            )}
            <div className="form-field">
              <label htmlFor="create-user-name">Name</label>
              <input
                id="create-user-name"
                type="text"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="create-user-email">Email</label>
              <input
                id="create-user-email"
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="create-user-role">Role</label>
              <select
                id="create-user-role"
                value={createForm.role}
                onChange={(event) => {
                  const role = event.target.value as AdminUserRole;
                  // Switching to ADMIN clears any selected route: an ADMIN
                  // must not carry one, and a stale selection would be sent.
                  setCreateForm((prev) => ({ ...prev, role, routeId: role === 'ADMIN' ? '' : prev.routeId }));
                }}
              >
                <option value="DRIVER">Driver</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            {createForm.role === 'DRIVER' && (
              <div className="form-field">
                <label htmlFor="create-user-route">Route</label>
                <select
                  id="create-user-route"
                  value={createForm.routeId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, routeId: event.target.value }))}
                  disabled={routesQuery.isPending}
                >
                  <option value="">Select a route</option>
                  {assignableRoutes(routes, null).map((route) => (
                    <option key={route.id} value={route.id}>
                      {routeOptionLabel(route)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-field">
              <label htmlFor="create-user-password">Temporary password</label>
              <input
                id="create-user-password"
                type={showCreatePassword ? 'text' : 'password'}
                value={createForm.password}
                autoComplete="new-password"
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              />
              <button type="button" className="link-button" onClick={() => setShowCreatePassword((shown) => !shown)}>
                {showCreatePassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {editingUser && !deactivateConfirmOpen && (
        <ConfirmDialog
          title={`Edit ${editingUser.name}`}
          message="Saving replaces this user's current details."
          confirmLabel="Save changes"
          onConfirm={handleEditSave}
          onCancel={closeEditDialog}
          confirmDisabled={updateUserMutation.isPending}
          dismissOnBackdropClick={false}
        >
          <div className="admin-form">
            {editError && (
              <p className="field-error" role="alert">
                {editError}
              </p>
            )}
            <div className="form-field">
              <label htmlFor="edit-user-name">Name</label>
              <input
                id="edit-user-name"
                type="text"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-user-email">Email</label>
              <input
                id="edit-user-email"
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-user-role">Role</label>
              <select
                id="edit-user-role"
                value={editForm.role}
                disabled={editingSelf}
                onChange={(event) => {
                  const role = event.target.value as AdminUserRole;
                  setEditForm((prev) => ({ ...prev, role, routeId: role === 'ADMIN' ? '' : prev.routeId }));
                }}
              >
                <option value="DRIVER">Driver</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            {editForm.role === 'DRIVER' && (
              <div className="form-field">
                <label htmlFor="edit-user-route">Route</label>
                <select
                  id="edit-user-route"
                  value={editForm.routeId}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, routeId: event.target.value }))}
                  disabled={routesQuery.isPending}
                >
                  <option value="">No route</option>
                  {assignableRoutes(routes, editingUser.route?.id ?? null).map((route) => (
                    <option key={route.id} value={route.id}>
                      {routeOptionLabel(route)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-field">
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  disabled={editingSelf}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Active
              </label>
            </div>
            {/* The backend rejects both of these outright; the form only
                avoids offering an action guaranteed to fail. */}
            {editingSelf && <p className="admin-form__note">{SELF_PROTECTION_NOTE}</p>}
          </div>
        </ConfirmDialog>
      )}

      {editingUser && deactivateConfirmOpen && (
        <ConfirmDialog
          title={`Deactivate ${editingUser.name}?`}
          message="This user will no longer be able to sign in. Deactivation is not deletion — the account remains and can be reactivated later."
          confirmLabel="Deactivate user"
          cancelLabel="Keep active"
          onConfirm={submitEdit}
          onCancel={() => setDeactivateConfirmOpen(false)}
          confirmDisabled={updateUserMutation.isPending}
        />
      )}

      {resetUser && (
        <ConfirmDialog
          title={`Reset password for ${resetUser.name}`}
          message="The current password is never shown and cannot be recovered. Enter a new one to replace it."
          confirmLabel="Reset password"
          onConfirm={handleResetPassword}
          onCancel={closeResetDialog}
          confirmDisabled={resetPasswordMutation.isPending}
          dismissOnBackdropClick={false}
        >
          <div className="admin-form">
            {resetError && (
              <p className="field-error" role="alert">
                {resetError}
              </p>
            )}
            <div className="form-field">
              <label htmlFor="reset-new-password">New password</label>
              <input
                id="reset-new-password"
                type={showResetPassword ? 'text' : 'password'}
                value={newPassword}
                autoComplete="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="reset-confirm-password">Confirm new password</label>
              <input
                id="reset-confirm-password"
                type={showResetPassword ? 'text' : 'password'}
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <button type="button" className="link-button" onClick={() => setShowResetPassword((shown) => !shown)}>
              {showResetPassword ? 'Hide passwords' : 'Show passwords'}
            </button>
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}
