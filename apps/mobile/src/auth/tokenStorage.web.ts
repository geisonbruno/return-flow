import type { StoredTokens } from './types';

const ACCESS_TOKEN_KEY = 'returnflow.accessToken';
const REFRESH_TOKEN_KEY = 'returnflow.refreshToken';

/**
 * Browser-only fallback for local web testing (see apps/mobile/README.md).
 * Expo SecureStore has no web implementation — Metro/Expo's platform file
 * resolution swaps this module in for `tokenStorage.ts` automatically
 * whenever the app bundles for the `web` platform (a `*.web.ts` file wins
 * over the extensionless one; native builds never see this file at all).
 *
 * `localStorage` is a development/testing convenience, not a production
 * browser-security decision — it is not equivalent to native SecureStore.
 * Native iOS/Android builds are unaffected and keep using SecureStore
 * exactly as before.
 */

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    // Accessing `localStorage` itself can throw in some sandboxed/private
    // browsing contexts — treat that the same as "unavailable".
    return null;
  }
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } catch {
    // Storage full/blocked — fail silently rather than throw an error that
    // could end up rendered (and never let a token value reach one either).
  }
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }
  let accessToken: string | null;
  let refreshToken: string | null;
  try {
    accessToken = storage.getItem(ACCESS_TOKEN_KEY);
    refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
  if (!accessToken || !refreshToken) {
    // A partial session (only one of the two values present) is never
    // usable — clean it up so a stale half-session can't linger.
    await clearTokens();
    return null;
  }
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Nothing more we can safely do.
  }
}
