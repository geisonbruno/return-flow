import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiClientForTests } from '../api/apiClient';
import { AuthProvider } from '../auth/AuthContext';
import { LoginPage } from './LoginPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ADMIN_SESSION = {
  accessToken: 'access-token-1',
  accessTokenExpiresAt: '2026-01-01T00:00:00Z',
  refreshToken: 'refresh-token-1',
  tokenType: 'Bearer',
};

const ADMIN_USER = {
  userId: 'user-1',
  fullName: 'Ada Admin',
  email: 'ada@warehouse.example',
  role: 'ADMIN',
  tenantId: 'tenant-1',
  tenantName: 'Warehouse',
};

function renderLoginPage(initialEntries: { pathname: string; state?: unknown }[] = [{ pathname: '/login' }]) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard Page</div>} />
            <Route path="/returns/:returnId" element={<div>Return Details Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    resetApiClientForTests();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders accessible, labeled email and password fields', () => {
    renderLoginPage();

    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    expect(email).toHaveAttribute('type', 'email');
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows a validation message and makes no request when fields are empty', async () => {
    renderLoginPage();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    });

    expect(await screen.findByText('Enter your email and password.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('logs an ADMIN in and redirects to the dashboard by default', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/login')) {
        return jsonResponse(200, ADMIN_SESSION);
      }
      if (url.includes('/auth/me')) {
        return jsonResponse(200, ADMIN_USER);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderLoginPage();
    await fillAndSubmit('ada@warehouse.example', 'password123');

    await waitFor(() => expect(screen.getByText('Dashboard Page')).toBeInTheDocument());
  });

  it('redirects back to the originally requested internal route after login', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/login')) {
        return jsonResponse(200, ADMIN_SESSION);
      }
      if (url.includes('/auth/me')) {
        return jsonResponse(200, ADMIN_USER);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderLoginPage([{ pathname: '/login', state: { from: '/returns/abc123' } }]);
    await fillAndSubmit('ada@warehouse.example', 'password123');

    await waitFor(() => expect(screen.getByText('Return Details Page')).toBeInTheDocument());
  });

  it('shows one generic message for invalid credentials, without leaking the backend detail, and keeps entered values', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(401, { title: 'Inactive Account', detail: 'This account is no longer active.' }));

    renderLoginPage();
    await fillAndSubmit('ada@warehouse.example', 'wrong-password');

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(screen.queryByText('This account is no longer active.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('ada@warehouse.example');
    expect(screen.getByLabelText('Password')).toHaveValue('wrong-password');
  });

  it('shows a network-failure message when the request cannot reach the server', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    renderLoginPage();
    await fillAndSubmit('ada@warehouse.example', 'password123');

    expect(await screen.findByText('Unable to connect to the server. Check your connection and try again.')).toBeInTheDocument();
  });

  it('disables the submit button while a login request is in flight', async () => {
    let resolveLogin!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveLogin = resolve;
        }),
    );

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@warehouse.example' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled());

    await act(async () => {
      resolveLogin(jsonResponse(401, {}));
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled());
  });
});
