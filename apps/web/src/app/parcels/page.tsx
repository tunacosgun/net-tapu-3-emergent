'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatPrice, resolveImageUrl } from '@/lib/format';
import {
  Button,
  Alert,
  EmptyState,
  LoadingState,
  Pagination,
  Badge,
} from '@/components/ui';
import { parcelStatusConfig } from '@/components/ui/badge';
import { useCompareStore } from '@/stores/compare-store';
import { CompareBar, CompareModal } from '@/components/parcel-compare';
import { ParcelDetailModal } from '@/components/parcel-detail-modal';
import {
  Search, LayoutGrid, Map as MapIcon, MapPin, X, Maximize2,
  Heart, Flame, Star, Check, SlidersHorizontal, Building2,
} from 'lucide-react';
import type { Parcel, PaginatedResponse } from '@/types';

const ParcelMapLazy = dynamic(() => import('@/components/parcel-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-50 rounded-xl" style={{ height: '450px' }}>
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
        <span className="text-sm text-gray-400">Harita yükleniyor...</span>
      </div>
    </div>
  ),
});

const STATUS_FILTERS = [
  { value: '', label: 'Tümü' },
  { value: 'active', label: 'Satışta' },
  { value: 'deposit_taken', label: 'Kaparo Alındı' },
  { value: 'sold', label: 'Satıldı' },
] as const;

type ViewMode = 'list' | 'map';

export default function ParcelsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ParcelsContent />
    </Suspense>
  );
}

function ParcelsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get('page') || '1');
  const city = searchParams.get('city') || '';
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const viewParam = searchParams.get('view') || 'list';

  const [data, setData] = useState<PaginatedResponse<Parcel> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);
  const [viewMode, setViewMode] = useState<ViewMode>(viewParam === 'map' ? 'map' : 'list');
  const [modalParcelId, setModalParcelId] = useState<string | null>(searchParams.get('parcel'));

  const fetchParcels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: viewMode === 'map' ? 100 : 12,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };
      if (statusFilter) params.status = statusFilter;
      if (city) params.city = city;
      if (search) params.search = search;

      const { data: res } = await apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params });
      setData(res);
    } catch {
      setError('Arsalar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [page, city, search, statusFilter, viewMode]);

  useEffect(() => { fetchParcels(); }, [fetchParcels]);

  function updateSearchParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.push(`/parcels?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateSearchParams({ search: searchInput, page: '1' });
  }

  function handleStatusFilter(status: string) {
    updateSearchParams({ status, page: '1' });
  }

  function handleViewToggle(mode: ViewMode) {
    setViewMode(mode);
    updateSearchParams({ view: mode, page: '1' });
  }

  function goToPage(p: number) {
    updateSearchParams({ page: String(p) });
  }

  return (
    <div className="bg-[var(--background)] min-h-screen">
      {/* Page Header */}
      <div className="border-b border-gray-200/80 bg-gray-50/80">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Arsalar</h1>
              {!loading && data && (
                <p className="mt-1 text-sm text-gray-500">{data.meta.total} arsa bulundu</p>
              )}
            </div>
            {/* View toggle */}
            <div className="flex rounded-xl border border-gray-200/80 bg-white overflow-hidden shadow-sm">
              <button
                onClick={() => handleViewToggle('list')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-brand-500 text-white shadow-inner'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Liste
              </button>
              <button
                onClick={() => handleViewToggle('map')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-l border-gray-200/80 transition-all duration-150 cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-brand-500 text-white shadow-inner'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MapIcon className="h-4 w-4" />
                Harita
              </button>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-5">
            <div className="relative flex items-center rounded-xl border border-gray-200/80 bg-white overflow-hidden shadow-sm focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400/30 transition-all duration-200">
              <Search className="ml-4 h-4.5 w-4.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Şehir, ilçe veya arsa adı ile arayın..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 bg-transparent px-3 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
              <button
                type="submit"
                className="shrink-0 bg-brand-500 hover:bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 cursor-pointer"
              >
                Ara
              </button>
            </div>
          </form>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-gray-400 mr-1" />
            {STATUS_FILTERS.map((sf) => (
              <button
                key={sf.value}
                onClick={() => handleStatusFilter(sf.value)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium border transition-all duration-150 cursor-pointer ${
                  statusFilter === sf.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200/80 bg-white text-gray-600 hover:border-gray-300 shadow-sm'
                }`}
              >
                {sf.label}
              </button>
            ))}
            {city && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200/80 px-3 py-1.5 text-sm font-medium text-blue-700">
                <MapPin className="h-3.5 w-3.5" />
                {city}
                <button onClick={() => updateSearchParams({ city: '' })} className="ml-0.5 text-blue-400 hover:text-blue-600 cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading && <LoadingState />}
        {error && <Alert className="mt-4">{error}</Alert>}

        {!loading && data && (
          <>
            {data.data.length === 0 ? (
              <EmptyState message="Arama kriterlerinize uygun arsa bulunamadı." />
            ) : viewMode === 'list' ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.data.map((parcel) => (
                  <ListParcelCard
                    key={parcel.id}
                    parcel={parcel}
                    onOpenModal={(id) => {
                      setModalParcelId(id);
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('parcel', id);
                      router.push(`/parcels?${params.toString()}`, { scroll: false });
                    }}
                  />
                ))}
              </div>
            ) : (
              <ParcelsMapView parcels={data.data} />
            )}

            {viewMode === 'list' && (
              <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={goToPage} />
            )}
          </>
        )}
      </div>

      <CompareBar />
      <CompareModal />

      {modalParcelId && (
        <ParcelDetailModal
          parcelId={modalParcelId}
          onClose={() => {
            setModalParcelId(null);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('parcel');
            router.push(`/parcels?${params.toString()}`, { scroll: false });
          }}
        />
      )}
    </div>
  );
}

/* ═══ List Parcel Card ═══ */
function ListParcelCard({ parcel, onOpenModal }: { parcel: Parcel; onOpenModal?: (id: string) => void }) {
  const status = parcelStatusConfig(parcel.status);
  const { toggleParcel, isSelected } = useCompareStore();
  const selected = isSelected(parcel.id);

  function handleClick(e: React.MouseEvent) {
    if (onOpenModal) { e.preventDefault(); onOpenModal(parcel.id); }
  }

  function handleCompareToggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); toggleParcel(parcel);
  }

  const coverImage = parcel.images?.find((i: any) => i.isCover && i.status === 'ready') || parcel.images?.find((i: any) => i.status === 'ready');

  return (
    <Link
      href={`/parcels/${parcel.id}`}
      onClick={handleClick}
      className={`group flex gap-4 rounded-2xl border p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer ${
        selected ? 'border-brand-500 bg-brand-50/30 shadow-md' : 'border-gray-200/60 bg-white'
      }`}
    >
      {/* Thumbnail */}
      <div className="shrink-0 h-28 w-36 rounded-xl overflow-hidden bg-gray-100">
        {coverImage ? (
          <img src={resolveImageUrl(coverImage)} alt={parcel.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <Building2 className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={handleCompareToggle}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-150 cursor-pointer ${
              selected ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300 text-transparent hover:border-brand-400'
            }`}
          >
            <Check className="h-3 w-3" />
          </button>
          <h2 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-brand-600 transition-colors duration-150">
            {parcel.title}
          </h2>
        </div>
        <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
        <MapPin className="h-3.5 w-3.5 text-gray-400" />
        {parcel.city}, {parcel.district}
        {parcel.neighborhood ? `, ${parcel.neighborhood}` : ''}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-bold text-brand-600 tracking-tight">{formatPrice(parcel.price)}</span>
        {parcel.areaM2 && (
          <span className="flex items-center gap-1 text-sm text-gray-500">
            <Maximize2 className="h-3.5 w-3.5 text-gray-400" />
            {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
          </span>
        )}
      </div>

      {parcel.pricePerM2 && (
        <p className="mt-1 text-xs text-gray-400">{formatPrice(parcel.pricePerM2)} / m²</p>
      )}

      {((parcel.favoriteCount ?? 0) > 0 || parcel.ada) && (
        <div className="mt-3 flex gap-3 flex-wrap text-xs text-gray-400">
          {(parcel.favoriteCount ?? 0) > 0 && (
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {parcel.favoriteCount} favori</span>
          )}
          {parcel.ada && parcel.parsel && (
            <span>Ada {parcel.ada} / Parsel {parcel.parsel}</span>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2 flex-wrap">
        {parcel.isAuctionEligible && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            <Flame className="h-3 w-3" /> Açık Artırma
          </span>
        )}
        {parcel.isFeatured && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            <Star className="h-3 w-3" /> Öne Çıkan
          </span>
        )}
      </div>
      </div>
    </Link>
  );
}

/* ═══ Map View ═══ */
function ParcelsMapView({ parcels }: { parcels: Parcel[] }) {
  const router = useRouter();
  const hasGeoData = parcels.some((p) => p.latitude && p.longitude);

  const cityGroups = parcels.reduce((acc, p) => {
    acc[p.city] = (acc[p.city] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {hasGeoData && (
        <div className="rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
          <ParcelMapLazy parcels={parcels} height="450px" />
        </div>
      )}

      <div className="flex gap-5 text-sm text-gray-500">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Satışta</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Kaparo Alındı</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Satıldı</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(cityGroups).sort(([a], [b]) => a.localeCompare(b, 'tr')).map(([cityName, count]) => {
          const cityParcels = parcels.filter((p) => p.city === cityName);
          return (
            <div key={cityName} className="rounded-2xl border border-gray-200/80 bg-white p-5 hover:shadow-md transition-shadow duration-200">
              <h3 className="font-semibold text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  {cityName}
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{count} arsa</span>
              </h3>
              <div className="mt-3 space-y-2">
                {cityParcels.slice(0, 5).map((p) => {
                  const st = parcelStatusConfig(p.status);
                  return (
                    <Link key={p.id} href={`/parcels/${p.id}`} className="flex items-center justify-between text-sm text-gray-600 hover:text-brand-600 transition-colors duration-150 cursor-pointer">
                      <span className="truncate pr-2">{p.title}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </Link>
                  );
                })}
                {cityParcels.length > 5 && (
                  <button onClick={() => router.push(`/parcels?city=${encodeURIComponent(cityName)}&view=list`)} className="text-xs font-medium text-brand-500 hover:text-brand-600 cursor-pointer">
                    +{cityParcels.length - 5} daha göster
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
