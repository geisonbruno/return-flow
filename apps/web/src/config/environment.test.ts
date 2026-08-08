import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl, resetApiBaseUrlForTests, toApiRelativePath } from './environment';

describe('toApiRelativePath', () => {
  it('strips the /api/v1 prefix from a backend-provided contentPath', () => {
    expect(toApiRelativePath('/api/v1/admin/returns/r1/photos/p1/content')).toBe('/admin/returns/r1/photos/p1/content');
  });

  it('leaves a path unchanged when it does not start with /api/v1', () => {
    expect(toApiRelativePath('/something-else')).toBe('/something-else');
  });
});

describe('contentPath resolution never duplicates /api/v1', () => {
  afterEach(() => {
    resetApiBaseUrlForTests();
    vi.unstubAllEnvs();
  });

  it('resolves correctly against the local same-origin default (/api/v1)', () => {
    resetApiBaseUrlForTests();
    const base = getApiBaseUrl();
    const resolved = `${base}${toApiRelativePath('/api/v1/admin/returns/r1/photos/p1/content')}`;

    expect(resolved).toBe('/api/v1/admin/returns/r1/photos/p1/content');
    expect(resolved).not.toContain('/api/v1/api/v1');
  });

  it('resolves correctly against an absolute configured deployment API base ending in /api/v1', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.returnflow.example.com/api/v1');
    resetApiBaseUrlForTests();
    const base = getApiBaseUrl();
    const resolved = `${base}${toApiRelativePath('/api/v1/admin/returns/r1/photos/p1/content')}`;

    expect(resolved).toBe('https://api.returnflow.example.com/api/v1/admin/returns/r1/photos/p1/content');
    expect(resolved).not.toContain('/api/v1/api/v1');
  });
});
