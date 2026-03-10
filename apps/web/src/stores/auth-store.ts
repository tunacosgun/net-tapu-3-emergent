import { create } from 'zustand';
import type { JwtPayload } from '@/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: JwtPayload | null;
  avatarUrl: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
  setLoading: (loading: boolean) => void;
  setAvatarUrl: (url: string | null) => void;
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
  avatarUrl: null,
  isLoading: true,
  isAuthenticated: false,

  setTokens: (accessToken, refreshToken) => {
    const user = decodeJwtPayload(accessToken);
    // Cookies are set server-side via /api/auth/session Route Handler.
    // Zustand holds in-memory copy for the current page lifecycle.
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  clearTokens: () => {
    // Clear the non-httpOnly AT cookie (httpOnly ones via DELETE /api/auth/session)
    try {
      document.cookie = 'nettapu_at=; path=/; Max-Age=0';
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
  setAvatarUrl: (url) => set({ avatarUrl: url }),
}));
