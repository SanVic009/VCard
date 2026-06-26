import axios from 'axios';
import { router } from 'expo-router';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

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

// Request Interceptor: Attach access token
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Silent refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
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
