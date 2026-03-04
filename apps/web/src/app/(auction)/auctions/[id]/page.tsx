'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuctionStore } from '@/stores/auction-store';
import { useAuthStore } from '@/stores/auth-store';
import { ConnectionStatus } from '@/components/connection-status';
import {
  connectToAuction,
  placeBid,
  disconnectFromAuction,
} from '@/lib/ws-client';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { Badge, Card, Alert, Button, LoadingState } from '@/components/ui';
import type { Auction, Payment } from '@/types';

function formatTime(ms: number | null): string {
  if (ms === null || ms <= 0) return '00:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  scheduled: 'Planlandı',
  deposit_open: 'Depozito Açık',
  live: 'CANLI',
  ending: 'Bitiyor',
  ended: 'Bitti',
  settling: 'Sonuçlanıyor',
  settled: 'Sonuçlandı',
  cancelled: 'İptal Edildi',
};

const statusColors: Record<string, string> = {
  live: 'bg-auction-live',
  ending: 'bg-auction-ending',
  scheduled: 'bg-auction-scheduled',
  deposit_open: 'bg-blue-500',
  ended: 'bg-auction-ended',
  settled: 'bg-auction-ended',
};

export default function AuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const auctionId = params.id;
  const userId = useAuthStore((s) => s.user?.sub);

  const {
    auctionDetail,
    auctionLoading,
    auctionError,
    hasActiveDeposit,
    depositLoading,
    status,
    currentPrice,
    bidCount,
    participantCount,
    watcherCount,
    timeRemainingMs,
    bidFeed,
    lastRejection,
    winnerIdMasked,
    finalPrice,
    setAuctionDetail,
    setAuctionError,
    setUserDeposit,
    setDepositLoading,
  } = useAuctionStore();

  const [bidAmount, setBidAmount] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1) Fetch auction detail from REST
  useEffect(() => {
    let cancelled = false;

    async function fetchAuction() {
      try {
        const { data } = await apiClient.get<Auction>(`/auctions/${auctionId}`);
        if (!cancelled) setAuctionDetail(data);
      } catch {
        if (!cancelled) setAuctionError('Açık artırma yüklenemedi.');
      }
    }

    fetchAuction();
    return () => { cancelled = true; };
  }, [auctionId, setAuctionDetail, setAuctionError]);

  // 2) Fetch user deposit status via payments API
  useEffect(() => {
    if (!userId) {
      setDepositLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchDepositPayment() {
      try {
        const { data } = await apiClient.get<{ data: Payment[]; meta: unknown }>(
          `/payments`,
          { params: { auctionId, limit: 1 } },
        );
        if (!cancelled) {
          const payment = data.data?.[0] ?? null;
          setUserDeposit(payment);
        }
      } catch {
        if (!cancelled) setUserDeposit(null);
      }
    }

    fetchDepositPayment();
    return () => { cancelled = true; };
  }, [auctionId, userId, setUserDeposit, setDepositLoading]);

  // 3) Connect WS after REST loads
  useEffect(() => {
    if (auctionLoading || auctionError) return;
    connectToAuction(auctionId);
    return () => disconnectFromAuction();
  }, [auctionId, auctionLoading, auctionError]);

  // 4) Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (timeRemainingMs && timeRemainingMs > 0) {
      const startedAt = Date.now();
      const initialMs = timeRemainingMs;

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, initialMs - elapsed);
        useAuctionStore.getState().setTimeRemaining(remaining);
        if (remaining <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
        }
      }, 250);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeRemainingMs]);

  function handleBid(e: FormEvent) {
    e.preventDefault();
    if (!bidAmount || !currentPrice) return;
    placeBid(auctionId, bidAmount, currentPrice);
    setBidAmount('');
  }

  const isLive = status === 'live' || status === 'ending';

  if (auctionLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingState centered={false} />
      </div>
    );
  }

  if (auctionError) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-red-600">{auctionError}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Status header + connection indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={`${statusColors[status ?? ''] || 'bg-gray-400'} text-white`}>
              {statusLabels[status ?? ''] || status}
            </Badge>
            <span className="text-2xl font-mono font-bold">
              {formatTime(timeRemainingMs)}
            </span>
          </div>
          <ConnectionStatus />
        </div>

        {/* Auction title */}
        {auctionDetail && (
          <h1 className="text-2xl font-bold">{auctionDetail.title}</h1>
        )}

        {/* Current price */}
        <Card className="p-6">
          <p className="text-sm text-[var(--muted-foreground)]">Güncel Fiyat</p>
          <p className="mt-1 text-4xl font-bold text-brand-500">
            {formatPrice(currentPrice)}
          </p>
          <div className="mt-4 flex gap-6 text-sm text-[var(--muted-foreground)]">
            <span>{bidCount} teklif</span>
            <span>{participantCount} katılımcı</span>
            <span>{watcherCount} izleyici</span>
          </div>
          {auctionDetail && (
            <div className="mt-2 flex gap-6 text-xs text-[var(--muted-foreground)]">
              <span>Başlangıç: {formatPrice(auctionDetail.startingPrice)}</span>
              <span>Min. artış: {formatPrice(auctionDetail.minimumIncrement)}</span>
            </div>
          )}
        </Card>

        {/* Deposit gating */}
        {isLive && !depositLoading && !hasActiveDeposit && (
          <Alert variant="warning" className="space-y-2">
            <p className="font-semibold">
              Teklif verebilmek için depozito yatırmanız gerekiyor.
            </p>
            <p className="text-xs">
              Gerekli depozito: {formatPrice(auctionDetail?.requiredDeposit ?? null)}
            </p>
            <Link
              href={`/auctions/${auctionId}/deposit`}
              className="mt-3 inline-block rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700 transition-colors"
            >
              Depozito Yatır
            </Link>
          </Alert>
        )}

        {/* Bid form — only if deposit active */}
        {isLive && hasActiveDeposit && (
          <form onSubmit={handleBid} className="flex gap-3">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Teklif tutarı (TRY)"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="flex-1 rounded-md border border-[var(--input)] bg-[var(--background)] px-4 py-3 text-lg font-mono shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button size="lg" disabled={!bidAmount} type="submit">
              Teklif Ver
            </Button>
          </form>
        )}

        {/* Rejection message */}
        {lastRejection && (
          <Alert>{lastRejection.message}</Alert>
        )}

        {/* Ended state */}
        {status === 'ended' && winnerIdMasked && (
          <div className="rounded-lg border-2 border-brand-500 p-6 text-center">
            <p className="text-lg font-semibold">Açık Artırma Sona Erdi</p>
            <p className="mt-2 text-3xl font-bold text-brand-500">
              {formatPrice(finalPrice)}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Kazanan: {winnerIdMasked}
            </p>
          </div>
        )}

        {/* Auction description */}
        {auctionDetail?.description && (
          <Card>
            <h3 className="text-sm font-semibold">Açıklama</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {auctionDetail.description}
            </p>
          </Card>
        )}
      </div>

      {/* Right column: Bid feed */}
      <div>
        <h2 className="text-lg font-semibold">Teklif Akışı</h2>
        <div className="mt-3 space-y-2 max-h-[600px] overflow-y-auto">
          {bidFeed.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Henüz teklif yok.
            </p>
          )}
          {bidFeed.map((bid) => (
            <div
              key={bid.bid_id}
              className={`flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 ${
                bid.bid_id.startsWith('optimistic-')
                  ? 'opacity-60 border-dashed'
                  : 'animate-bid-flash'
              }`}
            >
              <span className="text-sm text-[var(--muted-foreground)]">
                {bid.user_id_masked}
              </span>
              <span className="font-mono font-semibold">
                {formatPrice(bid.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
