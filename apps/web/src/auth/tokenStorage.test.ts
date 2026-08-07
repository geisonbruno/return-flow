import { beforeEach, describe, expect, it } from 'vitest';
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from './tokenStorage';

describe('tokenStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('persists the refresh token in sessionStorage only, under one key', () => {
    saveRefreshToken('a-refresh-token');

    expect(loadRefreshToken()).toBe('a-refresh-token');
    expect(sessionStorage.length).toBe(1);
    // Never localStorage — that would survive well past a closed browser session.
    expect(localStorage.length).toBe(0);
  });

  it('returns null when nothing has been stored', () => {
    expect(loadRefreshToken()).toBeNull();
  });

  it('clearRefreshToken removes the stored value', () => {
    saveRefreshToken('a-refresh-token');
    clearRefreshToken();
    expect(loadRefreshToken()).toBeNull();
  });

  it('a rotated token immediately replaces the previous value, not appends', () => {
    saveRefreshToken('first-token');
    saveRefreshToken('second-token');

    expect(loadRefreshToken()).toBe('second-token');
    expect(sessionStorage.length).toBe(1);
  });
});
