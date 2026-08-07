import { describe, expect, it } from 'vitest';
import { ApiError, toSafeErrorMessage } from './problemDetail';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ApiError', () => {
  it('network() produces a safe, generic message with no status/problem', () => {
    const error = ApiError.network();
    expect(error.kind).toBe('network');
    expect(error.status).toBeUndefined();
    expect(error.problem).toBeUndefined();
    expect(error.message).toBe('Unable to connect to the server.');
  });

  it('fromResponse() parses a JSON ProblemDetail body', async () => {
    const response = jsonResponse(401, { title: 'Invalid Credentials', status: 401, detail: 'Invalid email or password.' });
    const error = await ApiError.fromResponse(response);
    expect(error.kind).toBe('http');
    expect(error.status).toBe(401);
    expect(error.problem?.detail).toBe('Invalid email or password.');
    expect(error.message).toBe('Invalid email or password.');
  });

  it('fromResponse() falls back to a generic message for a non-JSON body', async () => {
    const response = new Response('<html>gateway error</html>', { status: 502, headers: { 'Content-Type': 'text/html' } });
    const error = await ApiError.fromResponse(response);
    expect(error.problem).toBeUndefined();
    expect(error.message).toBe('Request failed with status 502.');
  });
});

describe('toSafeErrorMessage', () => {
  it('returns the network-failure message for a network ApiError', () => {
    expect(toSafeErrorMessage(ApiError.network(), 'fallback')).toBe('Unable to connect to the server.');
  });

  it('maps a 401 to a session-expired message regardless of the underlying detail', async () => {
    const response = jsonResponse(401, { detail: 'Invalid or expired refresh token.' });
    const error = await ApiError.fromResponse(response);
    expect(toSafeErrorMessage(error, 'fallback')).toBe('Your session has expired. Please sign in again.');
  });

  it('prefers field errors over a generic detail when present', async () => {
    const response = jsonResponse(400, { detail: 'Validation failed.', errors: ['Email is required.', 'Password is required.'] });
    const error = await ApiError.fromResponse(response);
    expect(toSafeErrorMessage(error, 'fallback')).toBe('Email is required. Password is required.');
  });

  it('falls back for a non-ApiError value', () => {
    expect(toSafeErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
  });
});
