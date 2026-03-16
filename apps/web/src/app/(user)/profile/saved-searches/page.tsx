'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { LoadingState } from '@/components/ui';

interface SavedSearch {
  id: string;
  name: string | null;
  filters: Record<string, unknown>;
  notifyOnMatch: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SavedSearchesPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSearches = useCallback(async () => {
    try {
      const { data } = await apiClient.get<SavedSearch[]>('/saved-searches');
      setSearches(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSearches(); }, [fetchSearches]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bu aramayı silmek istediğinize emin misiniz?')) return;
    try {
      await apiClient.delete(`/saved-searches/${id}`);
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert('Silme işlemi başarısız.');
    }
  };

  const handleToggleNotify = async (search: SavedSearch) => {
    try {
      await apiClient.patch(`/saved-searches/${search.id}`, { notifyOnMatch: !search.notifyOnMatch });
      setSearches((prev) => prev.map((s) => s.id === search.id ? { ...s, notifyOnMatch: !s.notifyOnMatch } : s));
    } catch {
      alert('Güncelleme başarısız.');
    }
  };

  const handleGoToSearch = (search: SavedSearch) => {
    const params = new URLSearchParams();
    const f = search.filters;
    if (f.city) params.set('city', String(f.city));
    if (f.district) params.set('district', String(f.district));
    if (f.minPrice) params.set('minPrice', String(f.minPrice));
    if (f.maxPrice) params.set('maxPrice', String(f.maxPrice));
    if (f.minArea) params.set('minArea', String(f.minArea));
    if (f.maxArea) params.set('maxArea', String(f.maxArea));
    if (f.zoningStatus) params.set('zoningStatus', String(f.zoningStatus));
    if (f.search) params.set('search', String(f.search));
    if (f.status) params.set('status', String(f.status));
    router.push(`/parcels?${params.toString()}`);
  };

  function formatFilters(filters: Record<string, unknown>): string {
    const parts: string[] = [];
    if (filters.city) parts.push(String(filters.city));
    if (filters.district) parts.push(String(filters.district));
    if (filters.minPrice || filters.maxPrice) {
      const min = filters.minPrice ? Number(filters.minPrice).toLocaleString('tr-TR') : '0';
      const max = filters.maxPrice ? Number(filters.maxPrice).toLocaleString('tr-TR') : '...';
      parts.push(`${min} - ${max} TL`);
    }
    if (filters.minArea || filters.maxArea) {
      const min = filters.minArea ? `${filters.minArea}` : '0';
      const max = filters.maxArea ? `${filters.maxArea}` : '...';
      parts.push(`${min} - ${max} m\u00B2`);
    }
    if (filters.zoningStatus) parts.push(String(filters.zoningStatus));
    if (filters.search) parts.push(`"${filters.search}"`);
    return parts.length > 0 ? parts.join(' \u00B7 ') : 'T\u00FCm arsalar';
  }

  if (loading) return <div className="flex min-h-[300px] items-center justify-center"><LoadingState centered={false} /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Kayıtlı Aramalarım</h1>
        <span className="text-sm text-[var(--muted-foreground)]">{searches.length} arama</span>
      </div>

      {searches.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">Kayıtlı arama yok</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Arsalar sayfasında arama yaptıktan sonra aramayı kaydedebilirsiniz.
          </p>
          <button onClick={() => router.push('/parcels')} className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
            Arsalara Git
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((search) => (
            <div key={search.id} className="rounded-xl border border-[var(--border)] p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-[var(--foreground)] truncate">
                    {search.name || 'İsimsiz Arama'}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {formatFilters(search.filters)}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                    {new Date(search.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Notify toggle */}
                  <button
                    onClick={() => handleToggleNotify(search)}
                    title={search.notifyOnMatch ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${search.notifyOnMatch ? 'bg-brand-50 text-brand-600 border border-brand-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    {search.notifyOnMatch ? 'Aktif' : 'Kapalı'}
                  </button>

                  {/* Go to search */}
                  <button
                    onClick={() => handleGoToSearch(search)}
                    className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    Ara
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(search.id)}
                    className="rounded-lg border border-red-200 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
