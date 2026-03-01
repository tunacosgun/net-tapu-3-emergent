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

const statusColors: Record<string, string> = {
  live: 'bg-auction-live text-white',
  ending: 'bg-auction-ending text-white',
  scheduled: 'bg-auction-scheduled text-white',
  deposit_open: 'bg-blue-500 text-white',
  ended: 'bg-gray-400 text-white',
  settling: 'bg-gray-400 text-white',
  settled: 'bg-gray-400 text-white',
};

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Süre doldu';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)} gün`;
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold">Açık Artırmalar</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Canlı ve yaklaşan açık artırmaları inceleyin.
      </p>

      {loading && <LoadingState />}

      {error && <Alert className="mt-6">{error}</Alert>}

      {!loading && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="Aktif açık artırma bulunamadı." />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((auction) => (
                <Link
                  key={auction.id}
                  href={`/auctions/${auction.id}`}
                  className="group rounded-lg border border-[var(--border)] p-5 hover:border-brand-500 transition-colors"
                >
                  {/* Status badge */}
                  <div className="flex items-center justify-between">
                    <Badge className={statusColors[auction.status] || 'bg-gray-100 text-gray-700'}>
                      {statusLabels[auction.status] || auction.status}
                    </Badge>
                    {auction.status === 'live' && auction.scheduledEnd && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Kalan: {timeUntil(auction.extendedUntil || auction.scheduledEnd)}
                      </span>
                    )}
                    {auction.status === 'scheduled' && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Başlangıç: {timeUntil(auction.scheduledStart)}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="mt-3 font-semibold group-hover:text-brand-500 transition-colors line-clamp-2">
                    {auction.title}
                  </h2>

                  {/* Price info */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted-foreground)]">
                        {auction.currentPrice ? 'Güncel Fiyat' : 'Başlangıç'}
                      </span>
                      <span className="font-mono font-bold text-brand-500">
                        {formatPrice(auction.currentPrice || auction.startingPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted-foreground)]">Min. Artış</span>
                      <span className="font-mono">
                        {formatPrice(auction.minimumIncrement)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted-foreground)]">Depozito</span>
                      <span className="font-mono">
                        {formatPrice(auction.requiredDeposit)}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-4 flex gap-4 text-xs text-[var(--muted-foreground)]">
                    <span>{auction.bidCount} teklif</span>
                    <span>{auction.participantCount} katılımcı</span>
                    <span>{auction.watcherCount} izleyici</span>
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
