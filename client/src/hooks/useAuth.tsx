import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, UseMutationResult } from '@tanstack/react-query';
import { apiRequest, queryClient } from '../lib/queryClient';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  bio?: string;
  profileImageUrl?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  demoLoginMutation: UseMutationResult<User, Error, void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (response.status === 401) {
          return null;
        }
        if (!response.ok) {
          console.warn('Auth check failed:', response.status, response.statusText);
          return null;
        }
        const userData = await response.json();
        console.log('Auth check successful:', userData?.username);
        return userData;
      } catch (error) {
        console.warn('Auth check error:', error);
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30000, // 30 seconds
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const response = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Login failed');
      }
      return await response.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(['/api/auth/user'], user);
    },
    onError: (error: Error) => {
      console.error('Login failed:', error.message);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const response = await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(credentials) });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Registration failed');
      }
      return await response.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(['/api/auth/user'], user);
    },
    onError: (error: Error) => {
      console.error('Registration failed:', error.message);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/auth/user'], null);
      queryClient.clear(); // Clear all cached data
      window.location.href = '/auth'; // Redirect to auth page
    },
    onError: (error: Error) => {
      console.error('Logout failed:', error.message);
    },
  });

  const demoLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/auth/demo-login', { method: 'POST', body: JSON.stringify({}) });
      if (!response.ok) {
        throw new Error('Demo login failed');
      }
      return await response.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(['/api/auth/user'], user);
    },
    onError: (error: Error) => {
      console.error('Demo login failed:', error.message);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        demoLoginMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// AuthProvider now exported above