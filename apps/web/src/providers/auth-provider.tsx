'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import apiClient from '@/lib/api-client';
import type { LoginResponse } from '@/types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setTokens, clearTokens, setLoading } = useAuthStore();

  // Attempt silent refresh on mount
  useEffect(() => {
    let cancelled = false;

    async function silentRefresh() {
      try {
        const rt = sessionStorage.getItem('rt');
        if (!rt) {
          setLoading(false);
          return;
        }

        const { data } = await apiClient.post<LoginResponse>('/auth/refresh', {
          refreshToken: rt,
        });

        if (!cancelled) {
          setTokens(data.accessToken, data.refreshToken);
        }
      } catch {
        if (!cancelled) {
          clearTokens();
        }
      }
    }

    silentRefresh();
    return () => {
      cancelled = true;
    };
  }, [setTokens, clearTokens, setLoading]);

  return <>{children}</>;
}

export function useLogin() {
  const { setTokens } = useAuthStore();

  return useCallback(
    async (email: string, password: string) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', {
        email,
        password,
      });
      setTokens(data.accessToken, data.refreshToken);
      return data;
    },
    [setTokens],
  );
}

export function useRegister() {
  const { setTokens } = useAuthStore();

  return useCallback(
    async (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }) => {
      const { data } = await apiClient.post<LoginResponse>(
        '/auth/register',
        payload,
      );
      setTokens(data.accessToken, data.refreshToken);
      return data;
    },
    [setTokens],
  );
}

export function useLogout() {
  const { clearTokens } = useAuthStore();

  return useCallback(() => {
    clearTokens();
    window.location.href = '/';
  }, [clearTokens]);
}
