import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/problemDetail';
import { UnauthorizedRoleError, useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';
import { Icon } from '../components/Icon';
import { sanitizeRedirectTarget } from '../routes/safeRedirect';
import './LoginPage.css';

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

/** Page-local decorative field marks; the shared `Icon` set carries only navigation/status glyphs. */
function FieldIcon({ name, className = 'login-card__input-icon' }: { name: 'mail' | 'lock' | 'eye' | 'eye-off'; className?: string }) {
  const glyphs = {
    mail: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="2" />
        <path d="m3 6.5 9 6 9-6" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10.5" width="16" height="10" rx="2" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    'eye-off': (
      <>
        <path d="M9.9 5.8A8.7 8.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4.1M6.5 7.9A17 17 0 0 0 2.5 12S6 18.5 12 18.5a8.9 8.9 0 0 0 3.4-.65" />
        <path d="M10 10a3 3 0 0 0 4 4" />
        <path d="m3.5 3.5 17 17" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyphs[name]}
    </svg>
  );
}

export function LoginPage() {
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="login-page__ambient login-page__ambient--top" aria-hidden="true" />
      <div className="login-page__ambient login-page__ambient--bottom" aria-hidden="true" />

      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <div className="login-card__brand">
          <Icon name="brand" className="login-card__brand-mark" />
          <h1 className="login-card__wordmark">ReturnFlow</h1>
        </div>
        <h2 className="login-card__heading">Sign in to your account</h2>

        <div className="form-field">
          <label htmlFor="email">Email</label>
          <div className="login-card__input-wrap">
            <FieldIcon name="mail" />
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="password">Password</label>
          <div className="login-card__input-wrap">
            <FieldIcon name="lock" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className="login-card__input--toggleable"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              required
            />
            <button
              type="button"
              className="login-card__reveal"
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={submitting}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <FieldIcon name={showPassword ? 'eye-off' : 'eye'} className="login-card__reveal-icon" />
            </button>
          </div>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        {sessionMessage && <ErrorMessage message={sessionMessage} />}
        {error && <ErrorMessage message={error} />}
      </form>
    </main>
  );
}
