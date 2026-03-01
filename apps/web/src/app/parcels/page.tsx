'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { Button, Alert, EmptyState, LoadingState, Pagination } from '@/components/ui';
import type { Parcel, PaginatedResponse } from '@/types';

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

  const [data, setData] = useState<PaginatedResponse<Parcel> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  const fetchParcels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: 12,
        status: 'active',
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };
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
  }, [page, city, search]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchInput) params.set('search', searchInput);
    if (city) params.set('city', city);
    params.set('page', '1');
    router.push(`/parcels?${params.toString()}`);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/parcels?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold">Arsalar</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="mt-6 flex gap-3">
        <input
          type="text"
          placeholder="Ara... (şehir, ilçe, başlık)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 rounded-md border border-[var(--input)] bg-[var(--background)] px-4 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <Button type="submit">Ara</Button>
      </form>

      {loading && <LoadingState />}

      {error && <Alert className="mt-6">{error}</Alert>}

      {!loading && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="Sonuç bulunamadı." />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((parcel) => (
                <Link
                  key={parcel.id}
                  href={`/parcels/${parcel.id}`}
                  className="group rounded-lg border border-[var(--border)] p-4 hover:border-brand-500 transition-colors"
                >
                  <h2 className="font-semibold group-hover:text-brand-500 transition-colors">
                    {parcel.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {parcel.city}, {parcel.district}
                    {parcel.neighborhood ? `, ${parcel.neighborhood}` : ''}
                  </p>
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
                  <div className="mt-2 flex gap-2">
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
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={data.meta.totalPages}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  );
}
