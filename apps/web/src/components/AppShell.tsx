import { useState, type MouseEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NavigationGuardProvider, useNavigationGuard } from '../routes/navigationGuard';
import { Icon, type IconName } from './Icon';

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link';
}

function GuardedNavLink({ to, label, icon, collapsed }: { to: string; label: string; icon: IconName; collapsed: boolean }) {
  const navigate = useNavigate();
  const { isDirty, guardNavigation } = useNavigationGuard();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isDirty) return;
    event.preventDefault();
    guardNavigation(() => navigate(to));
  };
  return <NavLink to={to} className={navLinkClassName} onClick={handleClick} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}>
    <Icon name={icon} className="app-shell__nav-icon"/><span className="app-shell__nav-label">{label}</span>
  </NavLink>;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const hasCompactHeader = location.pathname === '/dashboard' || location.pathname === '/returns';
  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };
  const initial = user?.fullName.trim().charAt(0).toUpperCase() || 'A';

  return <NavigationGuardProvider>
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}`}>
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand-block">
          <div className="app-shell__brand-mark" aria-hidden="true"><Icon name="brand"/></div>
          <div className="app-shell__brand-copy"><span className="app-shell__brand">ReturnFlow</span></div>
        </div>
        <nav className="app-shell__nav" aria-label="Primary">
          <GuardedNavLink to="/dashboard" label="Dashboard" icon="dashboard" collapsed={collapsed}/>
          <GuardedNavLink to="/returns" label="Returns" icon="returns" collapsed={collapsed}/>
          <GuardedNavLink to="/users" label="Users" icon="users" collapsed={collapsed}/>
          <GuardedNavLink to="/routes" label="Routes" icon="routes" collapsed={collapsed}/>
        </nav>
        {user && <div className="app-shell__sidebar-user"><span className="account-avatar">{initial}1</span><span><strong>{user.fullName}</strong><small>Administrator</small></span></div>}
      </aside>
      <div className={`app-shell__main${hasCompactHeader ? ' app-shell__main--compact-header' : ''}`}>
        <header className="app-shell__topbar">
          <button type="button" className="icon-button app-shell__collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="menu"/></button>
          <details className="account-menu">
            <summary><span className="account-avatar">{initial}1</span><span>{user?.fullName}</span><Icon name="chevron"/></summary>
            <div className="account-menu__popover"><button type="button" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Log out'}</button></div>
          </details>
        </header>
        <main className="app-shell__content"><Outlet /></main>
      </div>
    </div>
  </NavigationGuardProvider>;
}
