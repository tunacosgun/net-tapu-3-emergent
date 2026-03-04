'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types';

interface Toast {
  id: number;
  message: string;
}

let toastId = 0;
let addToastFn: ((message: string) => void) | null = null;

export function showApiError(error: unknown) {
  // RateLimitError is handled by useRateLimit hook — skip if it leaks here
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'RateLimitError' &&
    'retryAfter' in error
  ) {
    showRateLimitToast((error as unknown as { retryAfter: number }).retryAfter);
    return;
  }

  let message = 'Beklenmeyen bir hata oluştu.';

  if (error && typeof error === 'object' && 'response' in error) {
    const axiosErr = error as AxiosError<ApiError>;
    const data = axiosErr.response?.data;
    if (data?.message) {
      message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    } else if (axiosErr.response?.status === 403) {
      message = 'Bu işlem için yetkiniz bulunmuyor.';
    } else if (axiosErr.response?.status === 404) {
      message = 'İstenilen kaynak bulunamadı.';
    } else if (axiosErr.code === 'ERR_NETWORK') {
      message = 'Sunucuya bağlanılamadı.';
    }
  }

  addToastFn?.(message);
}

export function showRateLimitToast(retryAfter: number) {
  addToastFn?.(`Çok fazla istek. ${retryAfter} saniye sonra tekrar deneyin.`);
}

export function ApiErrorToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
