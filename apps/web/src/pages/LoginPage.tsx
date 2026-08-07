import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/problemDetail';
import { UnauthorizedRoleError, useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';
import { sanitizeRedirectTarget } from '../routes/safeRedirect';

const GENERIC_INVALID_LOGIN_MESSAGE = 'Invalid email or password.';
const NETWORK_ERROR_MESSAGE = 'Unable to connect to the server. Check your connection and try again.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Never distinguishes *why* a login attempt failed (inactive account,
 * unknown email, wrong password all reach here as one generic `ApiError`)
 * — see root `CLAUDE.md` §24 and this module's own instructions: the
 * backend already returns one shared message for all of those, but this
 * still re-collapses anything unexpected to the same generic text rather
 * than surfacing raw `ProblemDetail` content.
 */
function toLoginErrorMessage(error: unknown): string {
  if (error instanceof UnauthorizedRoleError) {
    return error.message;
  }
  if (error instanceof ApiError) {
    return error.kind === 'network' ? NETWORK_ERROR_MESSAGE : GENERIC_INVALID_LOGIN_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

export function LoginPage() {
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(sanitizeRedirectTarget(from), { replace: true });
    } catch (submitError) {
      setError(toLoginErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <h1>ReturnFlow</h1>
        <p className="login-form__subtitle">Admin sign in</p>

        {sessionMessage && <ErrorMessage message={sessionMessage} />}
        {error && <ErrorMessage message={error} />}

        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
