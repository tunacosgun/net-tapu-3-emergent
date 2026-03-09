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
  live: 'CANLI',
  ending: 'Bitiyor',
  ended: 'Bitti',
  settling: 'Sonuçlanıyor',
  settled: 'Sonuçlandı',
};

const statusColors: Record<string, { bg: string; dot: string; glow: string }> = {
  live: { bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', glow: 'shadow-emerald-500/30' },
  ending: { bg: 'bg-amber-500/10 text-amber-700 border-amber-200', dot: 'bg-amber-500', glow: 'shadow-amber-500/30' },
  scheduled: { bg: 'bg-blue-500/10 text-blue-700 border-blue-200', dot: 'bg-blue-500', glow: 'shadow-blue-500/30' },
  deposit_open: { bg: 'bg-indigo-500/10 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', glow: '' },
  ended: { bg: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400', glow: '' },
  settling: { bg: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400', glow: '' },
  settled: { bg: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400', glow: '' },
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

function AuctionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawPage = searchParams.get('page');
  const page = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;

  const [data, setData] = useState<PaginatedResponse<Auction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await apiClient.get<PaginatedResponse<Auction>>(
        '/auctions',
        { params: { page, limit: 12 } },
      );
      setData(res);
    } catch {
      setError('Açık artırmalar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/auctions?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Açık Artırmalar</h1>
            <p className="text-[var(--muted-foreground)]">
              Canlı ve yaklaşan açık artırmaları inceleyin.
            </p>
          </div>
        </div>
      </div>

      {loading && <LoadingState />}

      {error && <Alert className="mt-6">{error}</Alert>}

      {!loading && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="Aktif açık artırma bulunamadı." />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((auction) => {
                const sc = statusColors[auction.status] || statusColors.ended;
                const isLive = auction.status === 'live' || auction.status === 'ending';

                return (
                  <Link
                    key={auction.id}
                    href={`/auctions/${auction.id}`}
                    className={`group relative rounded-2xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                      isLive
                        ? 'border-emerald-200 shadow-lg shadow-emerald-100/50 hover:shadow-emerald-200/50'
                        : 'border-[var(--border)] shadow-md shadow-gray-100/50 hover:shadow-gray-200/50 hover:border-brand-200'
                    }`}
                  >
                    {/* Live indicator ring */}
                    {isLive && (
                      <div className="absolute -top-px -right-px -left-px -bottom-px rounded-2xl border-2 border-emerald-400/30 animate-pulse pointer-events-none" />
                    )}

                    {/* Status & Timer */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${sc.bg}`}>
                        <span className={`h-2 w-2 rounded-full ${sc.dot} ${isLive ? 'animate-pulse' : ''} shadow-sm ${sc.glow}`} />
                        {statusLabels[auction.status] || auction.status}
                      </span>
                      {auction.status === 'live' && auction.scheduledEnd && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {timeUntil(auction.extendedUntil || auction.scheduledEnd)}
                        </span>
                      )}
                      {auction.status === 'scheduled' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-600">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {timeUntil(auction.scheduledStart)}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="mt-4 text-lg font-bold group-hover:text-brand-600 transition-colors line-clamp-2">
                      {auction.title}
                    </h2>

                    {/* Current Price - Hero Style */}
                    <div className={`mt-5 rounded-xl p-4 ${isLive ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200' : 'bg-[var(--muted)]'}`}>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                        {auction.currentPrice ? 'Güncel Fiyat' : 'Başlangıç Fiyatı'}
                      </p>
                      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${isLive ? 'text-emerald-600' : 'text-brand-600'}`}>
                        {formatPrice(auction.currentPrice || auction.startingPrice)}
                      </p>
                    </div>

                    {/* Details */}
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--muted-foreground)]">Min. Artış</span>
                        <span className="font-semibold">{formatPrice(auction.minimumIncrement)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--muted-foreground)]">Depozito</span>
                        <span className="font-semibold">{formatPrice(auction.requiredDeposit)}</span>
                      </div>
                    </div>

                    {/* Stats Footer */}
                    <div className="mt-5 flex items-center gap-4 pt-4 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <span className="font-semibold">{auction.participantCount}</span> katılımcı
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                        </svg>
                        <span className="font-semibold">{auction.bidCount}</span> teklif
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-semibold">{auction.watcherCount}</span> izleyici
                      </span>
                    </div>
                  </Link>
                );
              })}
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
