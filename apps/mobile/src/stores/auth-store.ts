import { create } from 'zustand';
import * as Keychain from 'react-native-keychain';
import type { JwtPayload } from '../types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: JwtPayload | null;
  avatarUrl: string | null;
  showAvatarInAuction: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  hydrate: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setAvatarUrl: (url: string | null) => void;
  setShowAvatarInAuction: (show: boolean) => void;
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

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  avatarUrl: null,
  showAvatarInAuction: true,
  isLoading: true,
  isAuthenticated: false,

  setTokens: async (accessToken, refreshToken) => {
    const user = decodeJwtPayload(accessToken);
    // Securely persist tokens in device keychain
    await Keychain.setGenericPassword(
      'nettapu_tokens',
      JSON.stringify({ accessToken, refreshToken }),
    );
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  clearTokens: async () => {
    await Keychain.resetGenericPassword();
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      avatarUrl: null,
    });
  },

  hydrate: async () => {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        const { accessToken, refreshToken } = JSON.parse(credentials.password);
        if (accessToken && !isTokenExpired(accessToken)) {
          const user = decodeJwtPayload(accessToken);
          set({
            accessToken,
            refreshToken,
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
        // Token expired — try refresh later via API client interceptor
        if (refreshToken) {
          set({ refreshToken, isLoading: false });
          return;
        }
      }
    } catch {
      // Keychain error
    }
    set({ isLoading: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setShowAvatarInAuction: (show) => set({ showAvatarInAuction: show }),
}));
