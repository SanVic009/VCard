import axios from 'axios';
import { router } from 'expo-router';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

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

    // Silent refresh on 401
    if (error.response.status === 401 && !originalRequest._retry) {
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
        router.replace('/auth/login');
        return Promise.reject(refreshError);
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
