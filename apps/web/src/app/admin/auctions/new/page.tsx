'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { auctionSchema, type AuctionFormData } from '@/lib/validators';
import { FormField, FormTextarea } from '@/components/form-field';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button, PageHeader } from '@/components/ui';

export default function AdminNewAuctionPage() {
  const router = useRouter();
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AuctionFormData>({
    resolver: zodResolver(auctionSchema),
    defaultValues: { currency: 'TRY' },
  });

  async function onSubmit(data: AuctionFormData) {
    if (new Date(data.endTime) <= new Date(data.startTime)) {
      setError('endTime', { message: 'Bitiş tarihi başlangıçtan sonra olmalı' });
      return;
    }

    const body = {
      parcelId: data.parcelId,
      title: data.title,
      description: data.description || undefined,
      startTime: new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString(),
      depositDeadline: new Date(data.depositDeadline).toISOString(),
      startingPrice: data.startingPrice,
      minimumIncrement: data.minimumIncrement,
      requiredDeposit: data.requiredDeposit,
      currency: data.currency || 'TRY',
    };

    try {
      await apiClient.post('/auctions', body);
      router.push('/admin/auctions');
    } catch (err) {
      if (!checkRateLimit(err)) showApiError(err);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Yeni Açık Artırma" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="Arsa ID (UUID) *"
          error={errors.parcelId?.message}
          {...register('parcelId')}
        />
        <FormField
          label="Başlık *"
          error={errors.title?.message}
          {...register('title')}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Başlangıç Tarihi *"
            type="datetime-local"
            error={errors.startTime?.message}
            {...register('startTime')}
          />
          <FormField
            label="Bitiş Tarihi *"
            type="datetime-local"
            error={errors.endTime?.message}
            {...register('endTime')}
          />
        </div>
        <FormField
          label="Depozito Son Tarihi *"
          type="datetime-local"
          error={errors.depositDeadline?.message}
          {...register('depositDeadline')}
        />
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Başlangıç Fiyatı *"
            type="number"
            error={errors.startingPrice?.message}
            {...register('startingPrice')}
          />
          <FormField
            label="Minimum Artış *"
            type="number"
            error={errors.minimumIncrement?.message}
            {...register('minimumIncrement')}
          />
          <FormField
            label="Gerekli Depozito *"
            type="number"
            error={errors.requiredDeposit?.message}
            {...register('requiredDeposit')}
          />
        </div>
        <FormField
          label="Para Birimi"
          error={errors.currency?.message}
          {...register('currency')}
        />
        <FormTextarea
          label="Açıklama"
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting || isLimited}>
            {isLimited
              ? `${cooldown}s bekleyin`
              : isSubmitting
                ? 'Oluşturuluyor...'
                : 'Oluştur'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            İptal
          </Button>
        </div>
      </form>
    </div>
  );
}
