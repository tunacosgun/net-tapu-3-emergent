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
    <div className="flex items-center justify-center bg-[var(--muted)] rounded-lg" style={{ height: '450px' }}>
      <p className="text-sm text-[var(--muted-foreground)]">Harita yükleniyor...</p>
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
  const [viewMode, setViewMode] = useState<ViewMode>(
    viewParam === 'map' ? 'map' : 'list',
  );
  const [modalParcelId, setModalParcelId] = useState<string | null>(
    searchParams.get('parcel'),
  );

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
      if (statusFilter) {
        params.status = statusFilter;
      }
      // When no status filter ("Tümü"), omit status param — backend returns all visible parcels
      if (city) params.city = city;
      if (search) params.search = search;

      const { data: res } = await apiClient.get<PaginatedResponse<Parcel>>(
        '/parcels',
        { params },
      );
      setData(res);
    } catch {
      setError('Arsalar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [page, city, search, statusFilter, viewMode]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

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
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Arsalar</h1>
        {/* View Toggle */}
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => handleViewToggle('list')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-brand-500 text-white'
                : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
            }`}
          >
            ☰ Liste
          </button>
          <button
            onClick={() => handleViewToggle('map')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'map'
                ? 'bg-brand-500 text-white'
                : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
            }`}
          >
            🗺 Harita
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="mt-6 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="Ara... (şehir, ilçe, başlık)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 rounded-md border border-[var(--input)] bg-[var(--background)] px-4 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <Button type="submit">Ara</Button>
        </form>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => handleStatusFilter(sf.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
                statusFilter === sf.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:border-brand-300'
              }`}
            >
              {sf.label}
            </button>
          ))}
          {city && (
            <span className="rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 flex items-center gap-1">
              📍 {city}
              <button
                onClick={() => updateSearchParams({ city: '' })}
                className="ml-1 text-blue-400 hover:text-blue-600"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      </div>

      {loading && <LoadingState />}

      {error && <Alert className="mt-6">{error}</Alert>}

      {!loading && data && (
        <>
          {/* Result count */}
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            {data.meta.total} arsa bulundu
          </p>

          {data.data.length === 0 ? (
            <EmptyState message="Sonuç bulunamadı." />
          ) : viewMode === 'list' ? (
            /* ─── LIST VIEW ─── */
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            /* ─── MAP VIEW ─── */
            <div className="mt-6">
              <ParcelsMapView parcels={data.data} />
            </div>
          )}

          {viewMode === 'list' && (
            <Pagination
              page={page}
              totalPages={data.meta.totalPages}
              onPageChange={goToPage}
            />
          )}
        </>
      )}

      {/* Comparison floating bar + modal */}
      <CompareBar />
      <CompareModal />

      {/* Parcel detail modal overlay */}
      {modalParcelId && (
        <ParcelDetailModal
          parcelId={modalParcelId}
          onClose={() => {
            setModalParcelId(null);
            // Remove parcel param from URL
            const params = new URLSearchParams(searchParams.toString());
            params.delete('parcel');
            router.push(`/parcels?${params.toString()}`, { scroll: false });
          }}
        />
      )}
    </div>
  );
}

/* ═══ Parcel Card Component ═══ */
function ParcelCard({
  parcel,
  onOpenModal,
}: {
  parcel: Parcel;
  onOpenModal?: (id: string) => void;
}) {
  const status = parcelStatusConfig(parcel.status);
  const { toggleParcel, isSelected } = useCompareStore();
  const selected = isSelected(parcel.id);

  function handleClick(e: React.MouseEvent) {
    // If modal is desired, prevent navigation
    if (onOpenModal) {
      e.preventDefault();
      onOpenModal(parcel.id);
    }
  }

  function handleCompareToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleParcel(parcel);
  }

  return (
    <Link
      href={`/parcels/${parcel.id}`}
      onClick={handleClick}
      className={`group relative rounded-lg border p-4 transition-colors ${
        selected
          ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
          : 'border-[var(--border)] hover:border-brand-500'
      }`}
    >
      {/* Compare checkbox - top left */}
      <button
        onClick={handleCompareToggle}
        className={`absolute top-3 left-3 h-5 w-5 rounded border flex items-center justify-center text-xs transition-colors ${
          selected
            ? 'bg-brand-500 border-brand-500 text-white'
            : 'border-[var(--border)] bg-[var(--background)] text-transparent hover:border-brand-300'
        }`}
        title="Karşılaştırmaya ekle"
      >
        ✓
      </button>

      {/* Status Badge - top right */}
      <Badge variant={status.variant} className="absolute top-3 right-3">
        {status.label}
      </Badge>

      <h2 className="pl-7 pr-20 font-semibold group-hover:text-brand-500 transition-colors">
        {parcel.title}
      </h2>

      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        {parcel.city}, {parcel.district}
        {parcel.neighborhood ? `, ${parcel.neighborhood}` : ''}
      </p>

      {/* Property details row */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-lg font-bold text-brand-500">
          {formatPrice(parcel.price)}
        </span>
        {parcel.areaM2 && (
          <span className="text-sm text-[var(--muted-foreground)]">
            {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
          </span>
        )}
      </div>

      {/* Price per m2 */}
      {parcel.pricePerM2 && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {formatPrice(parcel.pricePerM2)} / m²
        </p>
      )}

      {/* Favorite + Viewer counts */}
      {((parcel.favoriteCount ?? 0) > 0 || (parcel.viewerCount ?? 0) > 0) && (
        <div className="mt-2 flex gap-3 text-xs text-[var(--muted-foreground)]">
          {(parcel.favoriteCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-red-500">❤</span> {parcel.favoriteCount} kişi favoriye aldı
            </span>
          )}
          {(parcel.viewerCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-blue-500">👁</span> {parcel.viewerCount} kişi inceliyor
            </span>
          )}
        </div>
      )}

      {/* Tags row */}
      <div className="mt-2 flex gap-2 flex-wrap">
        {parcel.isAuctionEligible && (
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            Açık Artırma
          </span>
        )}
        {parcel.isFeatured && (
          <span className="rounded bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
            Öne Çıkan
          </span>
        )}
        {parcel.ada && parcel.parsel && (
          <span className="rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
            Ada/Parsel: {parcel.ada}/{parcel.parsel}
          </span>
        )}
      </div>
    </Link>
  );
}

/* ═══ Map View — Leaflet interactive map + city grouping fallback ═══ */
function ParcelsMapView({ parcels }: { parcels: Parcel[] }) {
  const router = useRouter();

  const hasGeoData = parcels.some((p) => p.latitude && p.longitude);

  // Group parcels by city for the city list below the map
  const cityGroups = parcels.reduce(
    (acc, p) => {
      acc[p.city] = (acc[p.city] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Interactive Leaflet Map */}
      {hasGeoData && (
        <ParcelMapLazy
          parcels={parcels}
          onParcelClick={(parcel) => router.push(`/parcels/${parcel.id}`)}
          height="450px"
        />
      )}

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          Satışta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
          Kaparo Alındı
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Satıldı
        </span>
      </div>

      {/* Parcel list grouped by city */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(cityGroups)
          .sort(([a], [b]) => a.localeCompare(b, 'tr'))
          .map(([city, count]) => {
            const cityParcels = parcels.filter((p) => p.city === city);
            return (
              <div
                key={city}
                className="rounded-lg border border-[var(--border)] p-4"
              >
                <h3 className="font-semibold flex items-center justify-between">
                  <span>📍 {city}</span>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {count} arsa
                  </span>
                </h3>
                <div className="mt-3 space-y-2">
                  {cityParcels.slice(0, 5).map((p) => {
                    const st = parcelStatusConfig(p.status);
                    return (
                      <Link
                        key={p.id}
                        href={`/parcels/${p.id}`}
                        className="flex items-center justify-between text-sm hover:text-brand-500"
                      >
                        <span className="truncate pr-2">{p.title}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </Link>
                    );
                  })}
                  {cityParcels.length > 5 && (
                    <button
                      onClick={() =>
                        router.push(
                          `/parcels?city=${encodeURIComponent(city)}&view=list`,
                        )
                      }
                      className="text-xs text-brand-500 hover:underline"
                    >
                      +{cityParcels.length - 5} daha fazla
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
