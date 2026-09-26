import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenPair, TokenStorage } from '@cymetric/sdk';

// expo-secure-store lives in the iOS Keychain and Android Keystore — both are
// hardware-backed when available. We never put tokens in AsyncStorage / MMKV
// because those are plaintext SQLite / mmap files that a rooted device or a
// malicious lib dep could scrape.
//
// On web (Expo's web target), SecureStore is a no-op that hangs, so we fall
// back to localStorage. Web is dev-only for us — production is native.
const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try { globalThis.localStorage?.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    try { globalThis.localStorage?.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const ACCESS_KEY = 'cs.accessToken';
const ACCESS_EXP_KEY = 'cs.accessTokenExpiresAt';
const REFRESH_KEY = 'cs.refreshToken';
const REFRESH_EXP_KEY = 'cs.refreshTokenExpiresAt';

export const secureTokenStorage: TokenStorage = {
  async getTokens(): Promise<TokenPair | null> {
    const [accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt] =
      await Promise.all([
        getItem(ACCESS_KEY),
        getItem(ACCESS_EXP_KEY),
        getItem(REFRESH_KEY),
        getItem(REFRESH_EXP_KEY),
      ]);
    if (!accessToken || !refreshToken) return null;
    return {
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt ?? new Date(Date.now() + 15 * 60_000).toISOString(),
      refreshToken,
      refreshTokenExpiresAt:
        refreshTokenExpiresAt ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
  },

  async setTokens(tokens: TokenPair): Promise<void> {
    await Promise.all([
      setItem(ACCESS_KEY, tokens.accessToken),
      setItem(ACCESS_EXP_KEY, tokens.accessTokenExpiresAt),
      setItem(REFRESH_KEY, tokens.refreshToken),
      setItem(REFRESH_EXP_KEY, tokens.refreshTokenExpiresAt),
    ]);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      deleteItem(ACCESS_KEY),
      deleteItem(ACCESS_EXP_KEY),
      deleteItem(REFRESH_KEY),
      deleteItem(REFRESH_EXP_KEY),
    ]);
  },
};
