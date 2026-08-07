import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link';
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
    <div className="app-shell">
      <header className="app-shell__header">
        <span className="app-shell__brand">ReturnFlow</span>
        {user && <span className="app-shell__tenant">{user.tenantName}</span>}
        <nav className="app-shell__nav" aria-label="Primary">
          <NavLink to="/dashboard" className={navLinkClassName}>
            Dashboard
          </NavLink>
          <NavLink to="/returns" className={navLinkClassName}>
            Returns
          </NavLink>
          <NavLink to="/users" className={navLinkClassName}>
            Users
          </NavLink>
          <NavLink to="/routes" className={navLinkClassName}>
            Routes
          </NavLink>
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
  );
}
