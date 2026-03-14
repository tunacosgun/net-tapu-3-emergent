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
          Array.isArray(msg) ? msg.join(', ') : msg || 'Kayit basarisiz.',
        );
      } else {
        setServerError('Kayit basarisiz.');
      }
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 text-center">Kayit Ol</h1>
      <p className="mt-1 text-center text-sm text-gray-500">
        Zaten hesabiniz var mi?{' '}
        <Link href="/login" className="text-brand-500 hover:underline font-medium">
          Giris yap
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
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

        {/* Legal consent checkboxes */}
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300"
                {...reg('acceptTerms')}
              />
              <span>
                <Link href="/legal" target="_blank" className="text-brand-500 hover:underline font-medium">
                  Kullanim Kosullari
                </Link>
                {' ve '}
                <Link href="/legal" target="_blank" className="text-brand-500 hover:underline font-medium">
                  Mesafeli Satis Sozlesmesi
                </Link>
                &apos;ni okudum ve kabul ediyorum. *
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="mt-1 ml-6 text-xs text-red-500">{errors.acceptTerms.message}</p>
            )}
          </div>
          <div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300"
                {...reg('acceptKvkk')}
              />
              <span>
                <Link href="/legal" target="_blank" className="text-brand-500 hover:underline font-medium">
                  KVKK Aydinlatma Metni
                </Link>
                &apos;ni okudum ve kisisel verilerimin islenmesini kabul ediyorum. *
              </span>
            </label>
            {errors.acceptKvkk && (
              <p className="mt-1 ml-6 text-xs text-red-500">{errors.acceptKvkk.message}</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || isLimited}
          className="w-full"
        >
          {isLimited
            ? `${cooldown}s bekleyin`
            : isSubmitting
              ? 'Kayit yapiliyor...'
              : 'Kayit Ol'}
        </Button>
      </form>
    </div>
  );
}
