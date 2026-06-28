import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// In-memory fallback for environments where neither SecureStore nor localStorage is writable
const memoryStorage: { [key: string]: string } = {};

const isWeb = Platform.OS === 'web';

export async function saveTokens(access_token: string, refresh_token: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
      return;
    } catch (e) {
      console.warn('localStorage is not available, falling back to memory storage:', e);
    }
  }

  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh_token);
  } catch (e) {
    console.warn('SecureStore error, falling back to memory storage:', e);
    memoryStorage[ACCESS_TOKEN_KEY] = access_token;
    memoryStorage[REFRESH_TOKEN_KEY] = refresh_token;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (isWeb) {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch (e) {
      // fallback to memory
    }
  }

  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch (e) {
    return memoryStorage[ACCESS_TOKEN_KEY] || null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (isWeb) {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (e) {
      // fallback to memory
    }
  }

  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (e) {
    return memoryStorage[REFRESH_TOKEN_KEY] || null;
  }
}

export async function clearTokens(): Promise<void> {
  if (isWeb) {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return;
    } catch (e) {
      // fallback to memory
    }
  }

  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (e) {
    delete memoryStorage[ACCESS_TOKEN_KEY];
    delete memoryStorage[REFRESH_TOKEN_KEY];
  }
}
