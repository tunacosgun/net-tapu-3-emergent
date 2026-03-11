'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { Button, Alert } from '@/components/ui';
import { FormField } from '@/components/form-field';
import { useAuthStore } from '@/stores/auth-store';

const callMeSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalıdır'),
  phone: z
    .string()
    .min(10, 'Geçerli bir telefon numarası giriniz')
    .regex(/^[0-9+\-\s()]+$/, 'Geçerli bir telefon numarası giriniz'),
  email: z
    .string()
    .email('Geçerli bir e-posta adresi giriniz')
    .optional()
    .or(z.literal('')),
  message: z.string().optional(),
});

type CallMeFormData = z.infer<typeof callMeSchema>;

interface CallMeFormProps {
  parcelId: string;
  parcelTitle: string;
  parcelListingId: string;
  onClose: () => void;
}

export function CallMeForm({
  parcelId,
  parcelTitle,
  parcelListingId,
  onClose,
}: CallMeFormProps) {
  const [success, setSuccess] = useState(false);
  const [wantsMessage, setWantsMessage] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const [profileLoaded, setProfileLoaded] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CallMeFormData>({
    resolver: zodResolver(callMeSchema),
  });

  // Auto-fill from profile for logged-in users
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.get<{ firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null }>('/auth/me')
      .then(({ data }) => {
        const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
        if (fullName) setValue('name', fullName);
        if (data.phone) setValue('phone', data.phone);
        if (data.email) setValue('email', data.email);
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(false));
  }, [isAuthenticated, setValue]);

  async function onSubmit(data: CallMeFormData) {
    try {
      await apiClient.post('/crm/contact-requests', {
        type: 'call_me',
        parcelId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        message: data.message || null,
      });
      setSuccess(true);
    } catch (err) {
      showApiError(err);
    }
  }

  const isLoggedInWithProfile = isAuthenticated && profileLoaded;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--background)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <h2 className="text-lg font-semibold">Sizi Arayalım</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Parcel info */}
          <div className="mb-4 rounded-lg bg-[var(--muted)] p-3 text-sm">
            <p className="font-medium">{parcelTitle}</p>
            <p className="text-[var(--muted-foreground)]">
              İlan No: {parcelListingId}
            </p>
          </div>

          {success ? (
            <div className="text-center py-4">
              <Alert variant="success">
                Talebiniz alındı! En kısa sürede sizi arayacağız.
              </Alert>
              <Button onClick={onClose} className="mt-4">
                Kapat
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* For logged-in users, show summary instead of form fields */}
              {isLoggedInWithProfile ? (
                <>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                    <p className="text-green-800 font-medium mb-1">✓ Bilgileriniz otomatik dolduruldu</p>
                    <p className="text-green-700 text-xs">Hesabınızdaki iletişim bilgileri kullanılacaktır.</p>
                  </div>

                  {/* Hidden fields still in form for validation */}
                  <input type="hidden" {...register('name')} />
                  <input type="hidden" {...register('phone')} />
                  <input type="hidden" {...register('email')} />

                  {/* Ask if they want to leave a message */}
                  {!wantsMessage ? (
                    <button
                      type="button"
                      onClick={() => setWantsMessage(true)}
                      className="w-full rounded-lg border border-dashed border-[var(--border)] py-3 text-sm text-[var(--muted-foreground)] hover:border-brand-500 hover:text-brand-600 transition-colors"
                    >
                      💬 Mesaj bırakmak ister misiniz?
                    </button>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium">Mesajınız</label>
                      <textarea
                        {...register('message')}
                        placeholder="Eklemek istediğiniz notlar..."
                        rows={3}
                        autoFocus
                        className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <FormField
                    label="Ad Soyad *"
                    error={errors.name?.message}
                    {...register('name')}
                    placeholder="Adınız Soyadınız"
                  />

                  <FormField
                    label="Telefon *"
                    error={errors.phone?.message}
                    {...register('phone')}
                    placeholder="0 5XX XXX XX XX"
                    type="tel"
                  />

                  <FormField
                    label="E-posta (opsiyonel)"
                    error={errors.email?.message}
                    {...register('email')}
                    placeholder="ornek@mail.com"
                    type="email"
                  />

                  <div>
                    <label className="block text-sm font-medium">
                      Mesajınız (opsiyonel)
                    </label>
                    <textarea
                      {...register('message')}
                      placeholder="Eklemek istediğiniz notlar..."
                      rows={3}
                      className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Gönderiliyor...' : 'Gönder'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                >
                  İptal
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
