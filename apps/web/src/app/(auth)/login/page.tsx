'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogin } from '@/providers/auth-provider';
import { useAuthStore } from '@/stores/auth-store';
import { loginSchema, type LoginFormData } from '@/lib/validators';
import { FormField } from '@/components/form-field';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button, Alert, LoadingState } from '@/components/ui';
import type { ApiError } from '@/types';
import { AxiosError } from 'axios';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function LoginContent() {
  const [serverError, setServerError] = useState<string | null>(null);
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const login = useLogin();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const oauthError = searchParams.get('error');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  async function onSubmit(data: LoginFormData) {
    setServerError(null);
    try {
      const tokens = await login(data.email, data.password);
      const user = useAuthStore.getState().user;
      const role = user?.roles?.includes('superadmin')
        ? 'superadmin'
        : user?.roles?.includes('admin')
          ? 'admin'
          : 'user';
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          role,
        }),
      });
      window.location.href = returnTo;
    } catch (err) {
      if (checkRateLimit(err)) return;
      if (err instanceof AxiosError) {
        const apiErr = err.response?.data as ApiError | undefined;
        const msg = apiErr?.message;
        setServerError(
          Array.isArray(msg) ? msg.join(', ') : msg || 'Giriş başarısız.',
        );
      } else {
        setServerError('Giriş başarısız.');
      }
    }
  }

  function handleGoogleLogin() {
    const googleUrl = `${API_URL}/api/v1/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = googleUrl;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-center">Giriş Yap</h1>
      <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
        Hesabınız yok mu?{' '}
        <Link href="/register" className="text-brand-500 hover:underline">
          Kayıt ol
        </Link>
      </p>

      {/* Social Login Buttons */}
      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-[0.98]"
        >
          <GoogleIcon />
          Google ile devam et
        </button>

        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-black px-4 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-900 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <AppleIcon />
          Apple ile devam et
          <span className="text-xs opacity-60">(Yakında)</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--background)] px-3 text-[var(--muted-foreground)]">
            veya e-posta ile
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {(serverError || oauthError) && (
          <Alert>
            {serverError ||
              (oauthError === 'google_auth_failed'
                ? 'Google ile giriş başarısız oldu. Lütfen tekrar deneyin.'
                : 'Giriş başarısız.')}
          </Alert>
        )}

        <FormField
          label="E-posta"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <FormField
          label="Parola"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded border-[var(--border)]" />
            Beni hatırla
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-brand-500 hover:underline"
          >
            Şifremi unuttum
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || isLimited}
          className="w-full"
        >
          {isLimited
            ? `${cooldown}s bekleyin`
            : isSubmitting
              ? 'Giriş yapılıyor...'
              : 'Giriş Yap'}
        </Button>
      </form>
    </div>
  );
}
