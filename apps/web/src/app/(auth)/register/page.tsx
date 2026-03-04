'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRegister } from '@/providers/auth-provider';
import { registerSchema, type RegisterFormData } from '@/lib/validators';
import { FormField } from '@/components/form-field';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button, Alert } from '@/components/ui';
import type { ApiError } from '@/types';
import { AxiosError } from 'axios';

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const {
    register: reg,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  const registerUser = useRegister();

  async function onSubmit(data: RegisterFormData) {
    setServerError(null);
    try {
      const tokens = await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
      });
      // Persist session in httpOnly cookies via Route Handler
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          role: 'user',
        }),
      });
      window.location.href = '/';
    } catch (err) {
      if (checkRateLimit(err)) return;
      if (err instanceof AxiosError) {
        const apiErr = err.response?.data as ApiError | undefined;
        const msg = apiErr?.message;
        setServerError(
          Array.isArray(msg) ? msg.join(', ') : msg || 'Kayıt başarısız.',
        );
      } else {
        setServerError('Kayıt başarısız.');
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-center">Kayıt Ol</h1>
      <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
        Zaten hesabınız var mı?{' '}
        <Link href="/login" className="text-brand-500 hover:underline">
          Giriş yap
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        {serverError && <Alert>{serverError}</Alert>}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Ad"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...reg('firstName')}
          />
          <FormField
            label="Soyad"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...reg('lastName')}
          />
        </div>

        <FormField
          label="E-posta"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...reg('email')}
        />

        <FormField
          label="Parola"
          type="password"
          autoComplete="new-password"
          hint="En az 8 karakter"
          error={errors.password?.message}
          {...reg('password')}
        />

        <FormField
          label="Telefon (opsiyonel)"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...reg('phone')}
        />

        <Button
          type="submit"
          disabled={isSubmitting || isLimited}
          className="w-full"
        >
          {isLimited
            ? `${cooldown}s bekleyin`
            : isSubmitting
              ? 'Kayıt yapılıyor...'
              : 'Kayıt Ol'}
        </Button>
      </form>
    </div>
  );
}
