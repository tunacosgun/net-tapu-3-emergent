'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { Button, Alert } from '@/components/ui';
import { FormField } from '@/components/form-field';

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CallMeFormData>({
    resolver: zodResolver(callMeSchema),
  });

  async function onSubmit(data: CallMeFormData) {
    try {
      await apiClient.post('/contact-requests', {
        type: 'call_me',
        parcelId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        message: data.message
          ? `${data.message}\n\n[İlan: ${parcelListingId} - ${parcelTitle}]`
          : `[İlan: ${parcelListingId} - ${parcelTitle}]`,
      });
      setSuccess(true);
    } catch (err) {
      showApiError(err);
    }
  }

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
