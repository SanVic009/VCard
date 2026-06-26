import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { getAccessToken, saveTokens, clearTokens } from '../lib/storage';
import { login as apiLogin, signup as apiSignup, logout as apiLogout, getMe, UserInfo } from '../lib/api';
import axios from 'axios';

type AuthContextType = {
  user: UserInfo | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const userData = await getMe();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (loading) return;
    
    const inAuthGroup = segments[0] === 'auth';
    
    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      router.replace('/(app)/dashboard');
    }
  }, [user, segments, loading]);

  const handleApiError = (error: any) => {
    if (!error.response) {
      throw new Error("Cannot reach server. Check your connection.");
    }
    const message = error.response?.data?.error?.message || error.response?.data?.detail || "An error occurred";
    throw new Error(message);
  };

  const login = async (email: string, password: string) => {
    try {
      const data = await apiLogin(email, password);
      await saveTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      router.replace('/(app)/dashboard');
    } catch (error) {
      handleApiError(error);
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      const data = await apiSignup(email, password);
      await saveTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      router.replace('/(app)/dashboard');
    } catch (error) {
      handleApiError(error);
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error (ignored):', error);
    } finally {
      await clearTokens();
      setUser(null);
      router.replace('/auth/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
