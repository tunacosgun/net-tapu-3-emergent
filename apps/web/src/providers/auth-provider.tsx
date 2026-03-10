'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import apiClient from '@/lib/api-client';
import type { LoginResponse } from '@/types';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now() - 30_000; // 30 s buffer
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setTokens, clearTokens, setLoading, setAvatarUrl } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function fetchAvatar() {
      try {
        const { data } = await apiClient.get<{ avatarUrl?: string | null }>('/auth/profile');
        if (!cancelled && data?.avatarUrl) setAvatarUrl(data.avatarUrl);
      } catch { /* ignore */ }
    }

    async function hydrate() {
      // 1. Try the non-httpOnly AT cookie (survives refresh)
      const at = getCookie('nettapu_at');
      if (at && !isJwtExpired(at)) {
        if (!cancelled) {
          setTokens(at, '');
          fetchAvatar();
        }
        return;
      }

      // 2. AT missing / expired → server-side refresh via httpOnly RT cookie
      try {
        const res = await fetch('/api/auth/session/refresh', { method: 'POST' });
        if (!res.ok) {
          if (!cancelled) {
            setLoading(false);
            clearTokens();
          }
          return;
        }
        const { accessToken, refreshToken } = await res.json();
        if (!cancelled) {
          setTokens(accessToken, refreshToken);
          fetchAvatar();
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          clearTokens();
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [setTokens, clearTokens, setLoading, setAvatarUrl]);

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

  return useCallback(async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      /* best-effort */
    }
    clearTokens();
    window.location.href = '/';
  }, [clearTokens]);
}
