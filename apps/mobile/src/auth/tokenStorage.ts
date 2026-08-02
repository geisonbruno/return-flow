import * as SecureStore from 'expo-secure-store';

import type { StoredTokens } from './types';

export type { StoredTokens };

const ACCESS_TOKEN_KEY = 'returnflow.accessToken';
const REFRESH_TOKEN_KEY = 'returnflow.refreshToken';

/**
 * Native (iOS/Android) implementation — tokens live only in SecureStore,
 * never AsyncStorage, never a plain module variable. `tokenStorage.web.ts`
 * is the browser counterpart Metro/Expo resolve instead of this file when
 * bundling for the `web` platform; see that file for why (SecureStore has
 * no web implementation).
 */
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)]);
}
