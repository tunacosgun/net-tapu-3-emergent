import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Keychain from 'react-native-keychain';
import { Config } from '../config/env';
import { useAuthStore } from '../stores/auth-store';

// ── Rate-limit error ────────────────────────────────────────────────────

export class RateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter}s`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

function parseRetryAfter(headers: Record<string, string>): number {
  const raw =
    headers['retry-after'] ?? headers['Retry-After'] ?? headers['x-retry-after'];
  if (!raw) return 60;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
}

const apiClient = axios.create({
  baseURL: `${Config.API_BASE_URL}${Config.API_PREFIX}`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach access token from Zustand store
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 refresh queue pattern
let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // 429 → RateLimitError
    if (error.response?.status === 429) {
      const retryAfter = parseRetryAfter(
        error.response.headers as Record<string, string>,
      );
      return Promise.reject(new RateLimitError(retryAfter));
    }

    // Don't retry auth endpoints
    if (
      originalRequest?.url?.includes('/auth/') ||
      originalRequest?._retry
    ) {
      return Promise.reject(error);
    }

    // 401 → Refresh token
    if (error.response?.status === 401) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { setTokens, clearTokens, refreshToken } = useAuthStore.getState();

      try {
        // Mobile: Direct call to backend with refresh token
        const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${Config.API_BASE_URL}${Config.API_PREFIX}/auth/refresh`,
          { refreshToken },
        );
        await setTokens(data.accessToken, data.refreshToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        await clearTokens();
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
