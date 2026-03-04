import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

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
  if (!raw) return 60; // conservative fallback
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token: Zustand first, then nettapu_at cookie (survives refresh)
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken || getCookie('nettapu_at');
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

    // Transform 429 into typed RateLimitError (runs for ALL endpoints including auth)
    if (error.response?.status === 429) {
      const retryAfter = parseRetryAfter(
        error.response.headers as Record<string, string>,
      );
      return Promise.reject(new RateLimitError(retryAfter));
    }

    // Don't retry auth endpoints for 401
    if (
      originalRequest?.url?.startsWith('/auth/') ||
      originalRequest?._retry
    ) {
      return Promise.reject(error);
    }

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

      const { setTokens, clearTokens } = useAuthStore.getState();

      try {
        // Server-side refresh via Route Handler (reads httpOnly RT cookie)
        const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
          '/api/auth/session/refresh',
        );
        setTokens(data.accessToken, data.refreshToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        clearTokens();
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
