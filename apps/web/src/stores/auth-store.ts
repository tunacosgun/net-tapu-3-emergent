import { create } from 'zustand';
import type { JwtPayload } from '@/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: JwtPayload | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
  setLoading: (loading: boolean) => void;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setTokens: (accessToken, refreshToken) => {
    const user = decodeJwtPayload(accessToken);
    try {
      sessionStorage.setItem('rt', refreshToken);
    } catch {
      // SSR or storage unavailable
    }
    // Set cookies for Edge middleware route gating
    try {
      document.cookie = 'has_session=1; path=/; SameSite=Lax';
      // Expose highest role for middleware admin gate (frontend UX only)
      const primaryRole = user?.roles?.includes('superadmin')
        ? 'superadmin'
        : user?.roles?.includes('admin')
          ? 'admin'
          : 'user';
      document.cookie = `role=${primaryRole}; path=/; SameSite=Lax`;
    } catch {
      // SSR
    }
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  clearTokens: () => {
    try {
      sessionStorage.removeItem('rt');
    } catch {
      // SSR or storage unavailable
    }
    try {
      document.cookie = 'has_session=; path=/; Max-Age=0';
      document.cookie = 'role=; path=/; Max-Age=0';
    } catch {
      // SSR
    }
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));
