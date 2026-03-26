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
  const { setTokens, clearTokens, setLoading, setAvatarUrl, setShowAvatarInAuction } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function fetchUserMeta() {
      try {
        const { data } = await apiClient.get<{ avatarUrl?: string | null; showAvatarInAuction?: boolean }>('/auth/me');
        if (!cancelled) {
          if (data?.avatarUrl) setAvatarUrl(data.avatarUrl);
          if (data?.showAvatarInAuction !== undefined) setShowAvatarInAuction(data.showAvatarInAuction);
        }
      } catch { /* ignore */ }
    }

    async function hydrate() {
      // 1. Try the non-httpOnly AT cookie (survives refresh)
      const at = getCookie('nettapu_at');
      if (at && !isJwtExpired(at)) {
        if (!cancelled) {
          setTokens(at, '');
          fetchUserMeta();
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
          fetchUserMeta();
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
  }, [setTokens, clearTokens, setLoading, setAvatarUrl, setShowAvatarInAuction]);

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

      // Persist session in httpOnly cookies for middleware
      const base64 = data.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      const role = payload.roles?.includes('superadmin')
        ? 'superadmin'
        : payload.roles?.includes('admin')
          ? 'admin'
          : 'user';
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          role,
        }),
      });

      return data;
    },
    [setTokens],
  );
}

export function useRegister() {
  const { setTokens } = useAuthStore();

  return useCallback(
    async (payload: {
      username: string;
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

      // Persist session in httpOnly cookies for middleware
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          role: 'user',
        }),
      });

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
