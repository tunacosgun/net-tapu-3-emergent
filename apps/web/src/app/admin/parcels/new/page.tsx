'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { parcelSchema, type ParcelFormData } from '@/lib/validators';
import { FormField, FormTextarea, FormCheckbox, FormSelect } from '@/components/form-field';
import { AddressGeocoder } from '@/components/address-geocoder';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button } from '@/components/ui';

export default function AdminNewParcelPage() {
  const router = useRouter();
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ParcelFormData>({
    resolver: zodResolver(parcelSchema),
    defaultValues: { isAuctionEligible: false, isFeatured: false, latitude: '', longitude: '' },
  });

  const selectedCity = watch('city');
  const selectedDistrict = watch('district');
  const watchedNeighborhood = watch('neighborhood');
  const watchedAddress = watch('address');
  const watchedLat = watch('latitude');
  const watchedLng = watch('longitude');

  // ── Location data state ──────────────────────────────────────────────
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);

  // ── Fetch cities on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<string[]>('/locations/cities')
      .then(({ data }) => {
        if (!cancelled) setCities(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Fetch districts when city changes ────────────────────────────────
  const fetchDistricts = useCallback(
    async (city: string) => {
      if (!city) {
        setDistricts([]);
        setNeighborhoods([]);
        return;
      }
      try {
        const { data } = await apiClient.get<string[]>('/locations/districts', {
          params: { city },
        });
        setDistricts(data);
      } catch {
        setDistricts([]);
      }
      setNeighborhoods([]);
    },
    [],
  );

  useEffect(() => {
    fetchDistricts(selectedCity);
  }, [selectedCity, fetchDistricts]);

  // ── Fetch neighborhoods when district changes ────────────────────────
  const fetchNeighborhoods = useCallback(
    async (city: string, district: string) => {
      if (!city || !district) {
        setNeighborhoods([]);
        return;
      }
      try {
        const { data } = await apiClient.get<string[]>(
          '/locations/neighborhoods',
          { params: { city, district } },
        );
        setNeighborhoods(data);
      } catch {
        setNeighborhoods([]);
      }
    },
    [],
  );

  useEffect(() => {
    fetchNeighborhoods(selectedCity, selectedDistrict);
  }, [selectedCity, selectedDistrict, fetchNeighborhoods]);

  // ── Reset dependent fields on parent change ──────────────────────────
  function handleCityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const city = e.target.value;
    setValue('city', city, { shouldValidate: true });
    setValue('district', '', { shouldValidate: false });
    setValue('neighborhood', '', { shouldValidate: false });
  }

  function handleDistrictChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const district = e.target.value;
    setValue('district', district, { shouldValidate: true });
    setValue('neighborhood', '', { shouldValidate: false });
  }

  function handleNeighborhoodChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setValue('neighborhood', e.target.value, { shouldValidate: true });
  }

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
          <FormSelect
            label="Şehir *"
            error={errors.city?.message}
            options={cities}
            placeholder="Şehir seçiniz..."
            value={selectedCity || ''}
            onChange={handleCityChange}
          />
          <FormSelect
            label="İlçe *"
            error={errors.district?.message}
            options={districts}
            placeholder="İlçe seçiniz..."
            value={selectedDistrict || ''}
            onChange={handleDistrictChange}
            disabled={!selectedCity}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormSelect
            label="Mahalle"
            error={errors.neighborhood?.message}
            options={neighborhoods}
            placeholder="Mahalle seçiniz..."
            value={watch('neighborhood') || ''}
            onChange={handleNeighborhoodChange}
            disabled={!selectedDistrict}
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
          city={selectedCity}
          district={selectedDistrict}
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
