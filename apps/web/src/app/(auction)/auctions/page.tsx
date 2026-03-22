'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { Badge, Pagination, Alert, EmptyState, LoadingState } from '@/components/ui';
import type { Auction, PaginatedResponse } from '@/types';

const statusLabels: Record<string, string> = {
  scheduled: 'Planlandı',
  deposit_open: 'Depozito Açık',
  live: 'Canlı',
  ending: 'Bitiyor',
  ended: 'Bitti',
  settling: 'Sonuçlanıyor',
  settled: 'Sonuçlandı',
};

const statusColors: Record<string, { bg: string; dot: string }> = {
  live: { bg: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  ending: { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  scheduled: { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  deposit_open: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  ended: { bg: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
  settling: { bg: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
  settled: { bg: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
};

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Süre doldu';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)} gün ${hours % 24} saat`;
  if (hours > 0) return `${hours} saat ${minutes} dk`;
  return `${minutes} dk`;
}

export default function AuctionsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuctionsContent />
    </Suspense>
  );
}

const filterTabs = [
  { key: 'all', label: 'Tümü' },
  { key: 'live', label: 'Canlı' },
  { key: 'scheduled', label: 'Planlandı' },
  { key: 'deposit_open', label: 'Depozito Açık' },
  { key: 'ended', label: 'Sona Erdi' },
];

function AuctionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawPage = searchParams.get('page');
  const page = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const statusFilter = searchParams.get('status') || 'all';

  const [data, setData] = useState<PaginatedResponse<Auction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: 12 };
      if (statusFilter !== 'all') {
        // "ended" filter includes ended, settling, settled
        if (statusFilter === 'ended') {
          params.status = 'ended,settling,settled';
        } else {
          params.status = statusFilter;
        }
      }
      const { data: res } = await apiClient.get<PaginatedResponse<Auction>>('/auctions', { params });
      setData(res);
    } catch {
      setError('Açık artırmalar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  function setFilter(key: string) {
    const params = new URLSearchParams();
    if (key !== 'all') params.set('status', key);
    params.set('page', '1');
    router.push(`/auctions?${params.toString()}`);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/auctions?${params.toString()}`);
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Açık Artırmalar</h1>
          <p className="mt-1 text-sm text-gray-500">Canlı ve yaklaşan açık artırmaları inceleyin.</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <LoadingState />}
        {error && <Alert className="mt-4">{error}</Alert>}

        {!loading && data && (
          <>
            {data.data.length === 0 ? (
              <EmptyState message="Aktif açık artırma bulunamadı." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.data.map((auction) => {
                  const sc = statusColors[auction.status] || statusColors.ended;
                  const isLive = auction.status === 'live' || auction.status === 'ending';

                  return (
                    <Link
                      key={auction.id}
                      href={`/auctions/${auction.id}`}
                      className={`block rounded-lg border p-5 hover:shadow-md transition-shadow ${
                        isLive ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${sc.bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot} ${isLive ? 'animate-pulse' : ''}`} />
                          {statusLabels[auction.status] || auction.status}
                        </span>
                        {auction.status === 'live' && auction.scheduledEnd && (
                          <span className="text-xs font-medium text-red-600">
                            {timeUntil(auction.extendedUntil || auction.scheduledEnd)}
                          </span>
                        )}
                        {auction.status === 'scheduled' && (
                          <span className="text-xs font-medium text-blue-600">
                            {timeUntil(auction.scheduledStart)}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 font-semibold text-gray-900 line-clamp-2">{auction.title}</h2>

                      <div className="mt-4 rounded-md bg-gray-50 border border-gray-100 p-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          {auction.currentPrice ? 'Güncel Fiyat' : 'Başlangıç Fiyatı'}
                        </p>
                        <p className={`mt-0.5 text-xl font-bold ${isLive ? 'text-green-600' : 'text-brand-600'}`}>
                          {formatPrice(auction.currentPrice || auction.startingPrice)}
                        </p>
                      </div>

                      <div className="mt-3 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Min. Artış</span>
                          <span className="font-medium text-gray-700">{formatPrice(auction.minimumIncrement)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Depozito</span>
                          <span className="font-medium text-gray-700">{formatPrice(auction.requiredDeposit)}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-gray-100">
                        <span>{auction.participantCount} katılımcı</span>
                        <span>{auction.bidCount} teklif</span>
                        <span>{auction.watcherCount} izleyici</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={goToPage} />
          </>
        )}
      </div>
    </div>
  );
}
