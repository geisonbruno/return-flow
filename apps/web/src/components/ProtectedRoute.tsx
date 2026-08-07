import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Guards every `/dashboard`, `/returns`, `/users`, `/routes` route. `status`
 * is only ever `'unauthenticated'` or `'authenticated'` here — `AppRoutes`
 * renders one full-page loading state instead of the router tree at all
 * while `status === 'restoring'`, so this component never has to guess
 * whether "not authenticated yet" means "logged out" or "still restoring".
 */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status !== 'authenticated') {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
