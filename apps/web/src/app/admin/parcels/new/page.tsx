'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { parcelSchema, type ParcelFormData } from '@/lib/validators';
import { FormField, FormTextarea, FormCheckbox } from '@/components/form-field';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button } from '@/components/ui';

export default function AdminNewParcelPage() {
  const router = useRouter();
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ParcelFormData>({
    resolver: zodResolver(parcelSchema),
    defaultValues: { isAuctionEligible: false, isFeatured: false },
  });

  async function onSubmit(data: ParcelFormData) {
    const body: Record<string, unknown> = {
      ...data,
      neighborhood: data.neighborhood || undefined,
      address: data.address || undefined,
      zoningStatus: data.zoningStatus || undefined,
      landType: data.landType || undefined,
      ada: data.ada || undefined,
      parsel: data.parsel || undefined,
      description: data.description || undefined,
    };

    try {
      await apiClient.post('/parcels', body);
      router.push('/admin/parcels');
    } catch (err) {
      if (!checkRateLimit(err)) showApiError(err);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Yeni Arsa</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="Başlık *"
          error={errors.title?.message}
          {...register('title')}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Şehir *"
            error={errors.city?.message}
            {...register('city')}
          />
          <FormField
            label="İlçe *"
            error={errors.district?.message}
            {...register('district')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Mahalle"
            error={errors.neighborhood?.message}
            {...register('neighborhood')}
          />
          <FormField
            label="Adres"
            error={errors.address?.message}
            {...register('address')}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Alan (m²)"
            type="number"
            error={errors.areaM2?.message}
            {...register('areaM2')}
          />
          <FormField
            label="Fiyat (TRY)"
            type="number"
            error={errors.price?.message}
            {...register('price')}
          />
          <FormField
            label="İmar Durumu"
            error={errors.zoningStatus?.message}
            {...register('zoningStatus')}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Arazi Türü"
            error={errors.landType?.message}
            {...register('landType')}
          />
          <FormField
            label="Ada"
            error={errors.ada?.message}
            {...register('ada')}
          />
          <FormField
            label="Parsel"
            error={errors.parsel?.message}
            {...register('parsel')}
          />
        </div>
        <div className="flex gap-6">
          <FormCheckbox
            label="Açık Artırmaya Uygun"
            {...register('isAuctionEligible')}
          />
          <FormCheckbox label="Öne Çıkan" {...register('isFeatured')} />
        </div>
        <FormTextarea
          label="Açıklama"
          rows={4}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting || isLimited}>
            {isLimited
              ? `${cooldown}s bekleyin`
              : isSubmitting
                ? 'Kaydediliyor...'
                : 'Kaydet'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            İptal
          </Button>
        </div>
      </form>
    </div>
  );
}
