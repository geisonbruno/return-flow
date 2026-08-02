import { clearTokens, loadTokens, saveTokens } from './tokenStorage.web';

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(() => store.clear()),
    key: jest.fn(() => null),
    length: 0,
  } as unknown as Storage;
}

function installLocalStorage(storage: Storage | undefined): void {
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

describe('tokenStorage.web', () => {
  afterEach(() => {
    installLocalStorage(undefined);
  });

  it('saves both tokens under namespaced keys', async () => {
    const storage = createMockStorage();
    installLocalStorage(storage);

    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' });

    expect(storage.setItem).toHaveBeenCalledWith(expect.stringContaining('returnflow'), 'a1');
    expect(storage.setItem).toHaveBeenCalledWith(expect.stringContaining('accessToken'), 'a1');
    expect(storage.setItem).toHaveBeenCalledWith(expect.stringContaining('refreshToken'), 'r1');
  });

  it('loads both saved values back', async () => {
    const storage = createMockStorage();
    installLocalStorage(storage);
    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' });

    await expect(loadTokens()).resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });

  it('clears both stored values', async () => {
    const storage = createMockStorage();
    installLocalStorage(storage);
    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' });

    await clearTokens();

    await expect(loadTokens()).resolves.toBeNull();
  });

  it('returns null when no tokens are stored', async () => {
    installLocalStorage(createMockStorage());

    await expect(loadTokens()).resolves.toBeNull();
  });

  it('treats a partial session (only one token present) as invalid and cleans it up', async () => {
    const storage = createMockStorage();
    installLocalStorage(storage);
    storage.setItem('returnflow.accessToken', 'only-access-present');

    const result = await loadTokens();

    expect(result).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('returnflow.accessToken');
    expect(storage.removeItem).toHaveBeenCalledWith('returnflow.refreshToken');
  });

  it('returns a safe no-session result when localStorage is unavailable (e.g. this default test environment)', async () => {
    installLocalStorage(undefined);

    await expect(loadTokens()).resolves.toBeNull();
    await expect(saveTokens({ accessToken: 'a1', refreshToken: 'r1' })).resolves.toBeUndefined();
    await expect(clearTokens()).resolves.toBeUndefined();
  });

  it('returns a safe no-session result when a localStorage read throws', async () => {
    const storage = createMockStorage();
    (storage.getItem as jest.Mock).mockImplementation(() => {
      throw new Error('SecurityError: access denied');
    });
    installLocalStorage(storage);

    await expect(loadTokens()).resolves.toBeNull();
  });

  it('a localStorage write failure resolves safely and never throws a token value', async () => {
    const storage = createMockStorage();
    (storage.setItem as jest.Mock).mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    installLocalStorage(storage);

    let caught: unknown;
    try {
      await saveTokens({ accessToken: 'super-secret-access-token', refreshToken: 'super-secret-refresh-token' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeUndefined();
  });
});
