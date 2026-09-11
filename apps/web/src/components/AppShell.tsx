import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NavigationGuardProvider, useNavigationGuard } from '../routes/navigationGuard';
import { Icon, type IconName } from './Icon';

/** The top-level pages that render their own compact header. */
const COMPACT_HEADER_PATHS = new Set(['/dashboard', '/returns', '/users', '/routes']);

/**
 * The one nested page that also renders the compact header. Matched by route
 * *pattern* rather than by raw pathname, so a path only qualifies when the
 * router actually resolves it to that page — an unmatched path such as
 * `/users/not-a-page`, or anything deeper than the pattern, still keeps the
 * normal shell header.
 */
const RETURN_DETAILS_ROUTE_PATTERN = '/returns/:returnId';

/**
 * Below this width the persistent sidebar would leave an unusable content
 * column, so the *same* sidebar becomes an overlay drawer instead. It is the
 * only viewport decision this component makes in JavaScript — everything else
 * in the responsive pass is CSS — and it matches the `768px` breakpoint the
 * stylesheets use for the same switch.
 */
const MOBILE_NAV_QUERY = '(max-width: 768px)';

/**
 * Between the drawer width and full desktop the persistent sidebar is kept,
 * but *defaults* to the shell's existing collapsed rail so the content column
 * gets the width back. It is only a default: the hamburger still toggles, and
 * an explicit choice keeps winning, so `aria-expanded` never disagrees with
 * what is on screen. No second sidebar and no new width.
 */
const RAIL_NAV_QUERY = '(max-width: 1100px)';

const SIDEBAR_ID = 'app-shell-sidebar';

/**
 * Tracks a media query, degrading to "no match" where `matchMedia` is absent
 * (jsdom, SSR) so the desktop presentation stays the default rather than the
 * component crashing.
 */
function useMediaQuery(query: string): boolean {
  // Resolved eagerly rather than in the effect alone: a phone would otherwise
  // paint the desktop shell first and correct itself a frame later.
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', handleChange);
    return () => list.removeEventListener('change', handleChange);
  }, [query]);
  return matches;
}

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link';
}

function GuardedNavLink({ to, label, icon, collapsed, onNavigate }: { to: string; label: string; icon: IconName; collapsed: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { isDirty, guardNavigation } = useNavigationGuard();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isDirty) {
      // The link itself still navigates; this only dismisses the mobile drawer.
      onNavigate?.();
      return;
    }
    event.preventDefault();
    guardNavigation(() => {
      navigate(to);
      onNavigate?.();
    });
  };
  return <NavLink to={to} className={navLinkClassName} onClick={handleClick} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}>
    <Icon name={icon} className="app-shell__nav-icon"/><span className="app-shell__nav-label">{label}</span>
  </NavLink>;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  // `null` means "follow the width-based default"; once the user decides, that
  // choice is authoritative at every width.
  const [collapsedChoice, setCollapsedChoice] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const returnDetailsMatch = useMatch(RETURN_DETAILS_ROUTE_PATTERN);
  const hasCompactHeader = COMPACT_HEADER_PATHS.has(location.pathname) || returnDetailsMatch !== null;
  const isMobileNav = useMediaQuery(MOBILE_NAV_QUERY);
  const isRailWidth = useMediaQuery(RAIL_NAV_QUERY);
  const collapsed = collapsedChoice ?? (isRailWidth && !isMobileNav);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Widening back to desktop must never leave the drawer state behind: the
  // persistent sidebar returns, so an "open drawer" would be meaningless.
  useEffect(() => {
    if (!isMobileNav) setDrawerOpen(false);
  }, [isMobileNav]);

  // Escape closes the drawer, and focus moves into it while it is open so a
  // keyboard user reaches the navigation rather than the page behind it.
  useEffect(() => {
    if (!isMobileNav || !drawerOpen) return;
    sidebarRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNav, drawerOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };
  const initial = user?.fullName.trim().charAt(0).toUpperCase() || 'A';

  // One control, two jobs: the desktop collapse toggle stays exactly as
  // approved, and only at drawer widths does it open/close the overlay.
  const menuLabel = isMobileNav
    ? (drawerOpen ? 'Close navigation' : 'Open navigation')
    : (collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  const handleMenuClick = () => {
    if (isMobileNav) setDrawerOpen((value) => !value);
    else setCollapsedChoice(!collapsed);
  };

  const shellClassName = [
    'app-shell',
    collapsed && !isMobileNav ? 'app-shell--collapsed' : '',
    isMobileNav ? 'app-shell--mobile-nav' : '',
    isMobileNav && drawerOpen ? 'app-shell--drawer-open' : '',
  ].filter(Boolean).join(' ');

  return <NavigationGuardProvider>
    <div className={shellClassName}>
      <aside id={SIDEBAR_ID} className="app-shell__sidebar" ref={sidebarRef} tabIndex={-1}>
        <div className="app-shell__brand-block">
          <div className="app-shell__brand-mark" aria-hidden="true"><Icon name="brand"/></div>
          <div className="app-shell__brand-copy"><span className="app-shell__brand">ReturnFlow</span></div>
        </div>
        <nav className="app-shell__nav" aria-label="Primary">
          <GuardedNavLink to="/dashboard" label="Dashboard" icon="dashboard" collapsed={collapsed} onNavigate={closeDrawer}/>
          <GuardedNavLink to="/returns" label="Returns" icon="returns" collapsed={collapsed} onNavigate={closeDrawer}/>
          <GuardedNavLink to="/users" label="Users" icon="users" collapsed={collapsed} onNavigate={closeDrawer}/>
          <GuardedNavLink to="/routes" label="Routes" icon="routes" collapsed={collapsed} onNavigate={closeDrawer}/>
        </nav>
        {user && <div className="app-shell__sidebar-user"><span className="account-avatar">{initial}1</span><span><strong>{user.fullName}</strong><small>Administrator</small></span></div>}
      </aside>
      {/* A redundant pointer affordance only: the hamburger and Escape are the
          keyboard paths, so this stays out of the accessibility tree. */}
      {isMobileNav && drawerOpen && <div className="app-shell__nav-backdrop" aria-hidden="true" onClick={closeDrawer}/>}
      <div className={`app-shell__main${hasCompactHeader ? ' app-shell__main--compact-header' : ''}`}>
        <header className="app-shell__topbar">
          <button ref={menuButtonRef} type="button" className="icon-button app-shell__collapse" onClick={handleMenuClick} aria-label={menuLabel} aria-expanded={isMobileNav ? drawerOpen : !collapsed} aria-controls={SIDEBAR_ID} title={menuLabel}><Icon name="menu"/></button>
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
