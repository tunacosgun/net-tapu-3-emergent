'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { parcelSchema, type ParcelFormData } from '@/lib/validators';
import { FormField, FormTextarea, FormCheckbox } from '@/components/form-field';
import { AddressGeocoder } from '@/components/address-geocoder';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button, PageHeader } from '@/components/ui';
import type { Parcel } from '@/types';

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  deposit_taken: 'Depozito Alındı',
  sold: 'Satıldı',
  withdrawn: 'Geri Çekildi',
};

export default function AdminEditParcelPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ParcelFormData>({ resolver: zodResolver(parcelSchema) });

  const watchedCity = watch('city');
  const watchedDistrict = watch('district');
  const watchedNeighborhood = watch('neighborhood');
  const watchedAddress = watch('address');
  const watchedLat = watch('latitude');
  const watchedLng = watch('longitude');

  useEffect(() => {
    let cancelled = false;
    async function fetchParcel() {
      try {
        const { data } = await apiClient.get<Parcel>(`/parcels/${params.id}`);
        if (!cancelled) {
          setParcel(data);
          reset({
            title: data.title,
            city: data.city,
            district: data.district,
            neighborhood: data.neighborhood || '',
            address: data.address || '',
            latitude: data.latitude || '',
            longitude: data.longitude || '',
            areaM2: data.areaM2 || '',
            price: data.price || '',
            zoningStatus: data.zoningStatus || '',
            landType: data.landType || '',
            ada: data.ada || '',
            parsel: data.parsel || '',
            isAuctionEligible: data.isAuctionEligible,
            isFeatured: data.isFeatured,
            description: data.description || '',
          });
          setLoading(false);
        }
      } catch (err) {
        showApiError(err);
        setLoading(false);
      }
    }
    fetchParcel();
    return () => {
      cancelled = true;
    };
  }, [params.id, reset]);

  async function onSubmit(data: ParcelFormData) {
    const body: Record<string, unknown> = {
      ...data,
      neighborhood: data.neighborhood || undefined,
      address: data.address || undefined,
      latitude: data.latitude || undefined,
      longitude: data.longitude || undefined,
      zoningStatus: data.zoningStatus || undefined,
      landType: data.landType || undefined,
      ada: data.ada || undefined,
      parsel: data.parsel || undefined,
      description: data.description || undefined,
    };

    try {
      await apiClient.patch(`/parcels/${params.id}`, body);
      router.push('/admin/parcels');
    } catch (err) {
      if (!checkRateLimit(err)) showApiError(err);
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      await apiClient.patch(`/parcels/${params.id}/status`, {
        status: newStatus,
      });
      setParcel((p) => (p ? { ...p, status: newStatus } : p));
    } catch (err) {
      if (!checkRateLimit(err)) showApiError(err);
    }
  }

  if (loading) return <TableSkeleton />;
  if (!parcel) return <p className="text-red-600">Arsa bulunamadı.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Arsa Düzenle"
        subtitle={`ID: ${parcel.id}`}
      />

      {/* Status change */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Durum:</span>
        <select
          value={parcel.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-sm"
        >
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

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
            label="Cadde / Sokak / Adres"
            error={errors.address?.message}
            {...register('address')}
          />
        </div>

        {/* ── Address Geocoder / Map ── */}
        <AddressGeocoder
          latitude={watchedLat}
          longitude={watchedLng}
          city={watchedCity}
          district={watchedDistrict}
          neighborhood={watchedNeighborhood}
          address={watchedAddress}
          onCoordsChange={(lat, lng) => {
            setValue('latitude', lat, { shouldValidate: true });
            setValue('longitude', lng, { shouldValidate: true });
          }}
        />

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
                : 'Güncelle'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            İptal
          </Button>
        </div>
      </form>
    </div>
  );
}
