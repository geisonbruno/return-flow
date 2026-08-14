import { useState, type ReactNode, type MouseEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NavigationGuardProvider, useNavigationGuard } from '../routes/navigationGuard';

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link';
}

/**
 * A `NavLink` that asks for confirmation before leaving whenever
 * `ReturnDetailsPage` has reported unsaved warehouse-review values —
 * otherwise behaves exactly like a plain `NavLink` (native middle-click/
 * ctrl-click "open in new tab" is preserved for the common, non-dirty case).
 */
function GuardedNavLink({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { isDirty, guardNavigation } = useNavigationGuard();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isDirty) {
      return;
    }
    event.preventDefault();
    guardNavigation(() => navigate(to));
  };

  return (
    <NavLink to={to} className={navLinkClassName} onClick={handleClick}>
      {children}
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // On success `status` flips to 'unauthenticated' and `ProtectedRoute`
      // unmounts this component on the next render; this only matters if
      // the component is somehow still mounted (e.g. under test).
      setLoggingOut(false);
    }
  };

  return (
    <NavigationGuardProvider>
      <div className="app-shell">
        <header className="app-shell__header">
          <span className="app-shell__brand">ReturnFlow</span>
          {user && <span className="app-shell__tenant">{user.tenantName}</span>}
          <nav className="app-shell__nav" aria-label="Primary">
            <GuardedNavLink to="/dashboard">Dashboard</GuardedNavLink>
            <GuardedNavLink to="/returns">Returns</GuardedNavLink>
            <GuardedNavLink to="/users">Users</GuardedNavLink>
            <GuardedNavLink to="/routes">Routes</GuardedNavLink>
          </nav>
          <div className="app-shell__account">
            {user && <span className="app-shell__user">{user.fullName}</span>}
            <button type="button" className="app-shell__logout" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Signing out…' : 'Log out'}
            </button>
          </div>
        </header>
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </NavigationGuardProvider>
  );
}
