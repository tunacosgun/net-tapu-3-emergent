'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { auctionSchema, type AuctionFormData } from '@/lib/validators';
import { FormField, FormTextarea } from '@/components/form-field';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button, PageHeader } from '@/components/ui';
import type { Parcel } from '@/types';

function formatPrice(price: string | null, currency = 'TRY') {
  if (!price) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function formatArea(area: string | null) {
  if (!area) return '—';
  return `${new Intl.NumberFormat('tr-TR').format(Number(area))} m²`;
}

function ParcelSelector({
  value,
  onChange,
  error,
  onParcelSelect,
}: {
  value: string;
  onChange: (id: string) => void;
  error?: string;
  onParcelSelect: (parcel: Parcel | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Parcel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchParcels = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '10',
        status: 'active',
        ...(q && { search: q }),
      });
      const res = await apiClient.get(`/admin/parcels?${params}`);
      setParcels(res.data.data || res.data || []);
    } catch {
      setParcels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial parcels when opened
  useEffect(() => {
    if (open && parcels.length === 0 && !search) {
      fetchParcels('');
    }
  }, [open, parcels.length, search, fetchParcels]);

  function handleSearch(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchParcels(val), 300);
  }

  function selectParcel(p: Parcel) {
    setSelected(p);
    onChange(p.id);
    onParcelSelect(p);
    setOpen(false);
    setSearch('');
  }

  function clearSelection() {
    setSelected(null);
    onChange('');
    onParcelSelect(null);
  }

  const coverImage = (p: Parcel) => {
    const cover = p.images?.find((img) => img.isCover) || p.images?.[0];
    return cover?.thumbnailUrl || cover?.originalUrl || null;
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
        Arsa Seçin *
      </label>

      {/* Selected parcel card */}
      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
          {coverImage(selected) ? (
            <img
              src={coverImage(selected)!}
              alt={selected.title}
              className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--muted)] flex-shrink-0">
              <svg className="h-6 w-6 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">{selected.title}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {selected.city}, {selected.district} · {formatArea(selected.areaM2)} · {formatPrice(selected.price)}
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] font-mono mt-0.5">{selected.listingId}</p>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-red-500 transition-colors flex-shrink-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        /* Search input */
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors ${
            error
              ? 'border-red-300 bg-red-50/50'
              : 'border-[var(--border)] bg-[var(--background)] hover:border-brand-300 hover:bg-brand-50/30'
          }`}
        >
          <svg className="h-5 w-5 text-[var(--muted-foreground)] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span className="text-sm text-[var(--muted-foreground)]">Arsa ara veya seçin...</span>
        </button>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
            <svg className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Başlık, şehir veya ilçe ile ara..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); fetchParcels(''); }}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <span className="ml-2 text-sm text-[var(--muted-foreground)]">Yükleniyor...</span>
              </div>
            ) : parcels.length === 0 ? (
              <div className="py-8 text-center">
                <svg className="mx-auto h-8 w-8 text-[var(--muted-foreground)] opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">Arsa bulunamadı</p>
              </div>
            ) : (
              parcels.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectParcel(p)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-brand-50 border-b border-[var(--border)] last:border-0"
                >
                  {coverImage(p) ? (
                    <img
                      src={coverImage(p)!}
                      alt={p.title}
                      className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--muted)] flex-shrink-0">
                      <svg className="h-5 w-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{p.title}</p>
                      {p.isAuctionEligible && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 flex-shrink-0">
                          Açık Artırma Uygun
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {p.city}, {p.district} · {formatArea(p.areaM2)}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs font-medium text-brand-600">{formatPrice(p.price)}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{p.listingId}</span>
                    </div>
                  </div>
                  <svg className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminNewAuctionPage() {
  const router = useRouter();
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [sniperEnabled, setSniperEnabled] = useState(true);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AuctionFormData>({
    resolver: zodResolver(auctionSchema),
    defaultValues: { currency: 'TRY', sniperEnabled: true },
  });

  // Auto-fill title when parcel selected
  function handleParcelSelect(parcel: Parcel | null) {
    setSelectedParcel(parcel);
    if (parcel) {
      setValue('title', `${parcel.title} - Açık Artırma`);
      if (parcel.price) {
        setValue('startingPrice', parcel.price);
      }
    }
  }

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
      sniperEnabled: data.sniperEnabled ?? true,
      ...(data.sniperWindowSeconds && { sniperWindowSeconds: Number(data.sniperWindowSeconds) }),
      ...(data.sniperExtensionSeconds && { sniperExtensionSeconds: Number(data.sniperExtensionSeconds) }),
      ...(data.maxSniperExtensions && { maxSniperExtensions: Number(data.maxSniperExtensions) }),
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Hidden input for react-hook-form */}
        <input type="hidden" {...register('parcelId')} />

        <ParcelSelector
          value=""
          onChange={(id) => setValue('parcelId', id, { shouldValidate: true })}
          error={errors.parcelId?.message}
          onParcelSelect={handleParcelSelect}
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

        {/* Anti-Sniping Configuration */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Anti-Sniping Koruması</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Son dakika tekliflerinde süre otomatik uzatılır
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={sniperEnabled}
                onChange={(e) => {
                  setSniperEnabled(e.target.checked);
                  setValue('sniperEnabled', e.target.checked);
                }}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-500 peer-checked:after:translate-x-full" />
            </label>
          </div>

          {sniperEnabled && (
            <div className="grid grid-cols-3 gap-4 pt-1">
              <FormField
                label="Sniper Penceresi (sn)"
                type="number"
                placeholder="120"
                error={errors.sniperWindowSeconds?.message}
                {...register('sniperWindowSeconds')}
              />
              <FormField
                label="Uzatma Süresi (sn)"
                type="number"
                placeholder="120"
                error={errors.sniperExtensionSeconds?.message}
                {...register('sniperExtensionSeconds')}
              />
              <FormField
                label="Maks Uzatma"
                type="number"
                placeholder="5"
                error={errors.maxSniperExtensions?.message}
                {...register('maxSniperExtensions')}
              />
              <p className="col-span-3 text-[11px] text-[var(--muted-foreground)]">
                Boş bırakırsanız sistem varsayılanları kullanılır (Pencere: 60sn, Uzatma: 60sn, Maks: 5)
              </p>
            </div>
          )}
        </div>

        {/* Summary card */}
        {selectedParcel && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Seçilen Arsa Özeti</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-[var(--muted-foreground)]">Konum:</span>{' '}
                <span className="font-medium">{selectedParcel.city}, {selectedParcel.district}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Alan:</span>{' '}
                <span className="font-medium">{formatArea(selectedParcel.areaM2)}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Fiyat:</span>{' '}
                <span className="font-medium">{formatPrice(selectedParcel.price)}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">İlan No:</span>{' '}
                <span className="font-medium font-mono">{selectedParcel.listingId}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting || isLimited}>
            {isLimited
              ? `${cooldown}s bekleyin`
              : isSubmitting
                ? 'Oluşturuluyor...'
                : 'Açık Artırma Oluştur'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            İptal
          </Button>
        </div>
      </form>
    </div>
  );
}
