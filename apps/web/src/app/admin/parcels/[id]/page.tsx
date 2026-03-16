'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { parcelSchema, type ParcelFormData } from '@/lib/validators';
import { FormField, FormTextarea, FormCheckbox } from '@/components/form-field';
import { AddressGeocoder } from '@/components/address-geocoder';
import { ImageUpload } from '@/components/image-upload';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button, PageHeader } from '@/components/ui';
import type { Parcel } from '@/types';

interface ParcelImage {
  id: string;
  originalUrl: string;
  thumbnailUrl: string | null;
  watermarkedUrl: string | null;
  status: string;
  sortOrder: number;
  isCover: boolean;
}

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  deposit_taken: 'Depozito Alindi',
  sold: 'Satildi',
  withdrawn: 'Geri Cekildi',
};

export default function AdminEditParcelPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [parcelImages, setParcelImages] = useState<ParcelImage[]>([]);
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
        const [{ data: parcelData }, { data: imagesData }] = await Promise.all([
          apiClient.get<Parcel>(`/parcels/${params.id}`),
          apiClient.get<ParcelImage[]>(`/parcels/${params.id}/images`),
        ]);
        if (!cancelled) {
          setParcel(parcelData);
          setParcelImages(imagesData || []);
          reset({
            title: parcelData.title,
            city: parcelData.city,
            district: parcelData.district,
            neighborhood: parcelData.neighborhood || '',
            address: parcelData.address || '',
            latitude: parcelData.latitude || '',
            longitude: parcelData.longitude || '',
            areaM2: parcelData.areaM2 || '',
            price: parcelData.price || '',
            zoningStatus: parcelData.zoningStatus || '',
            landType: parcelData.landType || '',
            ada: parcelData.ada || '',
            parsel: parcelData.parsel || '',
            isAuctionEligible: parcelData.isAuctionEligible,
            isFeatured: parcelData.isFeatured,
            showListingDate: parcelData.showListingDate !== false,
            description: parcelData.description || '',
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

  // ── TKGM Lookup ─────────────────────────────────────────────────────
  const [tkgmLoading, setTkgmLoading] = useState(false);
  const [tkgmResult, setTkgmResult] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tkgmBoundary, setTkgmBoundary] = useState<any>(null);
  const watchedAda = watch('ada');
  const watchedParsel = watch('parsel');
  const canLookup = !!(watchedCity && watchedDistrict && watchedAda && watchedParsel);

  async function handleTkgmLookup(e: MouseEvent) {
    e.preventDefault();
    if (!canLookup) return;
    setTkgmLoading(true);
    setTkgmResult(null);
    try {
      const { data } = await apiClient.post<{ responseData: Record<string, unknown> }>('/integrations/tkgm/lookup', {
        city: watchedCity,
        district: watchedDistrict,
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
      if (rd.boundary) setTkgmBoundary(rd.boundary);
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
  if (!parcel) return <p className="text-red-600">Arsa bulunamadi.</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Arsa Duzenle"
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
          label="Baslik *"
          error={errors.title?.message}
          {...register('title')}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Sehir *"
            error={errors.city?.message}
            {...register('city')}
          />
          <FormField
            label="Ilce *"
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

        {/* Address Geocoder / Map */}
        <AddressGeocoder
          latitude={watchedLat}
          longitude={watchedLng}
          city={watchedCity}
          district={watchedDistrict}
          neighborhood={watchedNeighborhood}
          address={watchedAddress}
          boundary={tkgmBoundary}
          onCoordsChange={(lat, lng) => {
            setValue('latitude', lat, { shouldValidate: true });
            setValue('longitude', lng, { shouldValidate: true });
          }}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Alan (m²)"
            type="number"
            step="any"
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
            label="Imar Durumu"
            error={errors.zoningStatus?.message}
            {...register('zoningStatus')}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Arazi Turu"
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
          <FormCheckbox label="İlan Tarihini Göster" {...register('showListingDate')} />
        </div>
        <FormTextarea
          label="Açıklama"
          rows={4}
          error={errors.description?.message}
          {...register('description')}
        />

        {/* Image Upload with existing images */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-4">Görseller</h2>
          <ImageUpload
            parcelId={params.id}
            images={parcelImages}
            onChange={setParcelImages}
          />
        </div>

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
