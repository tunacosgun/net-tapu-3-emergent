'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, type MouseEvent } from 'react';
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

  // ── TKGM Lookup ─────────────────────────────────────────────────────
  const [tkgmLoading, setTkgmLoading] = useState(false);
  const [tkgmResult, setTkgmResult] = useState<string | null>(null);

  const watchedAda = watch('ada');
  const watchedParsel = watch('parsel');
  const canLookup = !!(selectedCity && selectedDistrict && watchedAda && watchedParsel);

  async function handleTkgmLookup(e: MouseEvent) {
    e.preventDefault();
    if (!canLookup) return;
    setTkgmLoading(true);
    setTkgmResult(null);
    try {
      const { data } = await apiClient.post<{ responseData: Record<string, unknown> }>('/integrations/tkgm/lookup', {
        city: selectedCity,
        district: selectedDistrict,
        ada: watchedAda,
        parsel: watchedParsel,
      });
      const rd = data.responseData;
      if (rd.areaM2) setValue('areaM2', String(rd.areaM2), { shouldValidate: true });
      if (rd.latitude) setValue('latitude', String(rd.latitude), { shouldValidate: true });
      if (rd.longitude) setValue('longitude', String(rd.longitude), { shouldValidate: true });
      if (rd.neighborhood && typeof rd.neighborhood === 'string') {
        setValue('neighborhood', rd.neighborhood, { shouldValidate: true });
      }
      setTkgmResult('✓ Parsel bilgileri TKGM\'den alındı');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'TKGM sorgusu başarısız';
      setTkgmResult(`✗ ${msg}`);
    } finally {
      setTkgmLoading(false);
    }
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
        {/* TKGM Lookup */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canLookup || tkgmLoading}
            onClick={handleTkgmLookup}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400"
          >
            {tkgmLoading ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            )}
            {tkgmLoading ? 'Sorgulanıyor...' : 'TKGM\'den Sorgula'}
          </button>
          {!canLookup && <span className="text-xs text-[var(--muted-foreground)]">İl, İlçe, Ada ve Parsel doldurulmalı</span>}
          {tkgmResult && (
            <span className={`text-xs font-medium ${tkgmResult.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
              {tkgmResult}
            </span>
          )}
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
