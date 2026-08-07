import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '../components/AppShell';
import { FullPageLoading } from '../components/FullPageLoading';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../auth/AuthContext';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ReturnDetailsPage } from '../pages/ReturnDetailsPage';
import { ReturnsListPage } from '../pages/ReturnsListPage';
import { RoutesPage } from '../pages/RoutesPage';
import { UsersPage } from '../pages/UsersPage';

/** Authenticated ADMIN visiting `/login` is sent straight to the dashboard, never shown the form again. */
function LoginRoute() {
  const { status } = useAuth();
  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }
  return <LoginPage />;
}

export function AppRoutes() {
  const { status } = useAuth();

  // Never render the router tree while restoring: an unauthenticated-looking
  // status during restoration would otherwise flash Login before the real
  // (possibly authenticated) status resolves.
  if (status === 'restoring') {
    return <FullPageLoading label="Restoring your session…" />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/returns" element={<ReturnsListPage />} />
          <Route path="/returns/:returnId" element={<ReturnDetailsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          {/* Authenticated + unmatched: a real Not Found page, not a redirect. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
