import { requestJson } from '../api/apiClient';
import { logout, normalizeEmail } from './authService';

jest.mock('../api/apiClient', () => ({
  requestJson: jest.fn(),
  authorizedRequestJson: jest.fn(),
  refreshSession: jest.fn(),
}));

describe('normalizeEmail', () => {
  it('trims and lowercases, matching the backend EmailNormalizer rule', () => {
    expect(normalizeEmail('  Driver@Example.COM  ')).toBe('driver@example.com');
  });
});

describe('logout', () => {
  it('resolves even when the backend logout call fails, so the driver can always leave the app locally', async () => {
    (requestJson as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(logout('some-refresh-token')).resolves.toBeUndefined();
  });

  it('resolves normally when the backend logout call succeeds', async () => {
    (requestJson as jest.Mock).mockResolvedValue(undefined);

    await expect(logout('some-refresh-token')).resolves.toBeUndefined();
  });
});
