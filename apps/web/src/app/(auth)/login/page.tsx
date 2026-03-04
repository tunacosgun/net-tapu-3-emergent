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
      // Persist session in httpOnly cookies via Route Handler
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-center">Giriş Yap</h1>
      <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
        Hesabınız yok mu?{' '}
        <Link href="/register" className="text-brand-500 hover:underline">
          Kayıt ol
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        {serverError && <Alert>{serverError}</Alert>}

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
