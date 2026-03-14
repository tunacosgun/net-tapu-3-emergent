'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
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
import type { Parcel, PaginatedResponse } from '@/types';

const ParcelMapLazy = dynamic(() => import('@/components/parcel-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ height: '450px' }}>
      <p className="text-sm text-gray-400">Harita yükleniyor...</p>
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
    <div className="bg-white min-h-screen">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Arsalar</h1>
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                onClick={() => handleViewToggle('list')}
                className={`px-4 py-2 text-sm font-medium ${viewMode === 'list' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Liste
              </button>
              <button
                onClick={() => handleViewToggle('map')}
                className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${viewMode === 'map' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Harita
              </button>
            </div>
          </div>

          {/* Search + Filters */}
          <form onSubmit={handleSearch} className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Şehir, ilçe veya arsa adı ile arayın..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button type="submit" className="rounded-md bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
              Ara
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((sf) => (
              <button
                key={sf.value}
                onClick={() => handleStatusFilter(sf.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium border transition-colors ${
                  statusFilter === sf.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                {sf.label}
              </button>
            ))}
            {city && (
              <span className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 flex items-center gap-1">
                {city}
                <button onClick={() => updateSearchParams({ city: '' })} className="ml-1 text-blue-400 hover:text-blue-600">&times;</button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading && <LoadingState />}
        {error && <Alert className="mt-4">{error}</Alert>}

        {!loading && data && (
          <>
            <p className="text-sm text-gray-500 mb-4">{data.meta.total} arsa bulundu</p>

            {data.data.length === 0 ? (
              <EmptyState message="Sonuç bulunamadı." />
            ) : viewMode === 'list' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.data.map((parcel) => (
                  <ParcelCard
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
              <div>
                <ParcelsMapView parcels={data.data} />
              </div>
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

/* ═══ Parcel Card ═══ */
function ParcelCard({ parcel, onOpenModal }: { parcel: Parcel; onOpenModal?: (id: string) => void }) {
  const status = parcelStatusConfig(parcel.status);
  const { toggleParcel, isSelected } = useCompareStore();
  const selected = isSelected(parcel.id);

  function handleClick(e: React.MouseEvent) {
    if (onOpenModal) { e.preventDefault(); onOpenModal(parcel.id); }
  }

  function handleCompareToggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); toggleParcel(parcel);
  }

  return (
    <Link
      href={`/parcels/${parcel.id}`}
      onClick={handleClick}
      className={`block rounded-lg border p-4 hover:shadow-md transition-shadow ${
        selected ? 'border-brand-500 bg-brand-50/30' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={handleCompareToggle}
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${
              selected ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300 text-transparent hover:border-gray-400'
            }`}
          >
            ✓
          </button>
          <h2 className="text-sm font-semibold text-gray-900 line-clamp-2 hover:text-brand-600 transition-colors">
            {parcel.title}
          </h2>
        </div>
        <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
      </div>

      <p className="mt-1.5 text-xs text-gray-500 pl-6">
        {parcel.city}, {parcel.district}
        {parcel.neighborhood ? `, ${parcel.neighborhood}` : ''}
      </p>

      <div className="mt-3 flex items-center justify-between pl-6">
        <span className="text-base font-bold text-brand-600">{formatPrice(parcel.price)}</span>
        {parcel.areaM2 && <span className="text-sm text-gray-500">{Number(parcel.areaM2).toLocaleString('tr-TR')} m²</span>}
      </div>

      {parcel.pricePerM2 && (
        <p className="mt-0.5 text-xs text-gray-400 pl-6">{formatPrice(parcel.pricePerM2)} / m²</p>
      )}

      {((parcel.favoriteCount ?? 0) > 0 || parcel.ada) && (
        <div className="mt-2 flex gap-2 flex-wrap pl-6">
          {(parcel.favoriteCount ?? 0) > 0 && (
            <span className="text-xs text-gray-400">{parcel.favoriteCount} kişi favoriye aldı</span>
          )}
          {parcel.ada && parcel.parsel && (
            <span className="text-xs text-gray-400">Ada/Parsel: {parcel.ada}/{parcel.parsel}</span>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-1.5 flex-wrap pl-6">
        {parcel.isAuctionEligible && (
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">Açık Artırma</span>
        )}
        {parcel.isFeatured && (
          <span className="rounded bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">Öne Çıkan</span>
        )}
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
    <div className="space-y-4">
      {hasGeoData && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <ParcelMapLazy parcels={parcels} onParcelClick={(parcel) => router.push(`/parcels/${parcel.id}`)} height="450px" />
        </div>
      )}

      <div className="flex gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Satışta</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Kaparo Alındı</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Satıldı</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(cityGroups).sort(([a], [b]) => a.localeCompare(b, 'tr')).map(([city, count]) => {
          const cityParcels = parcels.filter((p) => p.city === city);
          return (
            <div key={city} className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-sm flex items-center justify-between">
                <span>{city}</span>
                <span className="text-xs text-gray-400">{count} arsa</span>
              </h3>
              <div className="mt-2 space-y-1.5">
                {cityParcels.slice(0, 5).map((p) => {
                  const st = parcelStatusConfig(p.status);
                  return (
                    <Link key={p.id} href={`/parcels/${p.id}`} className="flex items-center justify-between text-sm text-gray-600 hover:text-brand-600">
                      <span className="truncate pr-2">{p.title}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </Link>
                  );
                })}
                {cityParcels.length > 5 && (
                  <button onClick={() => router.push(`/parcels?city=${encodeURIComponent(city)}&view=list`)} className="text-xs text-brand-500 hover:underline">
                    +{cityParcels.length - 5} daha
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
