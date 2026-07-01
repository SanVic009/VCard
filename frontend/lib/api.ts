import axios from 'axios';
import Constants from 'expo-constants';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './storage';

let onUnauthorizedCallback: (() => void) | null = null;

export const registerUnauthorizedHandler = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:8000`;
    }
  }
  
  return envUrl || 'http://localhost:8000';
};

// Resolve the API URL from environment variable, falling back to dynamic config in dev or default production Render URL in prod
export const API_URL = __DEV__
  ? getBaseUrl()
  : (process.env.EXPO_PUBLIC_API_URL || 'https://app-ogvm.onrender.com');

const api = axios.create({
  baseURL: API_URL,
});

export interface UserInfo {
  id: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserInfo;
}

import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

// Request Interceptor: Check connectivity & attach access token
api.interceptors.request.use(async (config) => {
  const state = await NetInfo.fetch();
  if (state.isConnected === false) {
    Alert.alert("No internet connection.", "Please try again.");
    return Promise.reject(new Error("No internet connection. Please try again."));
  }

  const token = await getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Silent refresh on 401 and clean error messages
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle Network Connection Errors
    if (error.code === 'ERR_NETWORK' || !error.response) {
      error.message = "No internet connection. Please try again.";
      return Promise.reject(error);
    }

    // Handle Server Errors (5xx)
    if (error.response.status >= 500) {
      error.message = "Something went wrong. Please try again.";
      return Promise.reject(error);
    }

    // Silent refresh on 401 (skip for auth endpoints to prevent overriding credentials errors)
    const isAuthEndpoint = originalRequest.url && (
      originalRequest.url.includes('/auth/login') || 
      originalRequest.url.includes('/auth/signup') ||
      originalRequest.url.includes('/auth/refresh')
    );

    if (error.response.status === 401 && !isAuthEndpoint) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          // Make a direct axios call to avoid the interceptor loop
          const refreshResponse = await axios.post<AuthResponse>(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken
          });

          const newAuth = refreshResponse.data;
          await saveTokens(newAuth.access_token, newAuth.refresh_token);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAuth.access_token}`;
          return api(originalRequest);
          
        } catch (refreshError) {
          // Silent refresh failed
          await clearTokens();
          if (onUnauthorizedCallback) {
            onUnauthorizedCallback();
          }
          return Promise.reject(refreshError);
        }
      } else {
        // Already retried once but failed again with 401
        await clearTokens();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
      }
    }

    // Extract structured error message from backend if available
    if (error.response.data?.error?.message) {
      error.message = error.response.data.error.message;
    } else if (error.response.data?.detail) {
      error.message = typeof error.response.data.detail === 'string' 
        ? error.response.data.detail 
        : "Validation failed";
    }

    return Promise.reject(error);
  }
);

// Explicit Auth Helpers
export const signup = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/signup', { email, password });
  return response.data;
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', { email, password });
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const refresh = async (refreshToken: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken });
  return response.data;
};

export const getMe = async (): Promise<UserInfo> => {
  const response = await api.get<UserInfo>('/auth/me');
  return response.data;
};

export default api;
