'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { Card, Badge, Alert, EmptyState, LoadingState, Button } from '@/components/ui';
import type { Auction, Deposit } from '@/types';

interface AuctionParticipation {
  auction: Auction;
  deposit: Deposit;
  isWinner: boolean;
  highestBid: string | null;
}

const auctionStatusMap: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; label: string }> = {
  draft: { variant: 'default', label: 'Taslak' },
  scheduled: { variant: 'info', label: 'Planlandı' },
  live: { variant: 'success', label: 'Canlı' },
  extended: { variant: 'warning', label: 'Uzatıldı' },
  ended: { variant: 'default', label: 'Bitti' },
  settled: { variant: 'success', label: 'Sonuçlandı' },
  cancelled: { variant: 'danger', label: 'İptal' },
};

const depositStatusMap: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; label: string }> = {
  collected: { variant: 'info', label: 'Tahsil Edildi' },
  held: { variant: 'warning', label: 'Bekletiliyor' },
  captured: { variant: 'success', label: 'Alındı' },
  refund_pending: { variant: 'warning', label: 'İade Bekliyor' },
  refunded: { variant: 'default', label: 'İade Edildi' },
  expired: { variant: 'danger', label: 'Süresi Doldu' },
};

export default function AuctionsHistoryPage() {
  const [participations, setParticipations] = useState<AuctionParticipation[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'participations' | 'deposits'>('participations');

  useEffect(() => {
    async function fetchData() {
      try {
        const [depositsRes] = await Promise.all([
          apiClient.get<Deposit[]>('/deposits', { params: { mine: true } }),
        ]);
        setDeposits(Array.isArray(depositsRes.data) ? depositsRes.data : []);

        // Try to fetch auction participation data
        try {
          const { data } = await apiClient.get<AuctionParticipation[]>('/auctions/my-participations');
          setParticipations(Array.isArray(data) ? data : []);
        } catch {
          // Endpoint may not exist yet — derive from deposits
          setParticipations([]);
        }
      } catch {
        setError('İhale geçmişi yüklenemedi.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <Alert>{error}</Alert>;

  return (
    <div>
      <h2 className="text-lg font-semibold">İhale Geçmişim</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Katıldığınız açık artırmalar ve teminat bilgileriniz
      </p>

      {/* Tab switcher */}
      <div className="mt-6 flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
        <button
          onClick={() => setActiveTab('participations')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'participations'
              ? 'bg-brand-500 text-white'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
          }`}
        >
          İhalelerim
        </button>
        <button
          onClick={() => setActiveTab('deposits')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'deposits'
              ? 'bg-brand-500 text-white'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
          }`}
        >
          Teminatlarım ({deposits.length})
        </button>
      </div>

      {activeTab === 'participations' ? (
        <ParticipationsList participations={participations} deposits={deposits} />
      ) : (
        <DepositsList deposits={deposits} />
      )}
    </div>
  );
}

function ParticipationsList({
  participations,
  deposits,
}: {
  participations: AuctionParticipation[];
  deposits: Deposit[];
}) {
  // If no participation endpoint data, show deposits grouped by auction
  const items = participations.length > 0 ? participations : [];

  if (items.length === 0 && deposits.length === 0) {
    return <EmptyState message="Henüz bir ihaleye katılmadınız." />;
  }

  if (items.length === 0) {
    // Fallback: show auction IDs from deposits
    const auctionIds = [...new Set(deposits.map((d) => d.auctionId))];
    return (
      <div className="mt-6 space-y-3">
        {auctionIds.map((auctionId) => {
          const auctionDeposits = deposits.filter((d) => d.auctionId === auctionId);
          const latestDeposit = auctionDeposits[0];
          const ds = depositStatusMap[latestDeposit.status] || { variant: 'default' as const, label: latestDeposit.status };
          return (
            <Card key={auctionId} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/auctions/${auctionId}`}
                      className="font-medium hover:text-brand-500"
                    >
                      İhale: {auctionId.slice(0, 8)}...
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {auctionDeposits.map((dep) => {
                      const dStatus = depositStatusMap[dep.status] || { variant: 'default' as const, label: dep.status };
                      return (
                        <span key={dep.id} className="text-xs">
                          Teminat: {formatPrice(dep.amount)}
                          <Badge variant={dStatus.variant} className="ml-1">{dStatus.label}</Badge>
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {formatDate(latestDeposit.createdAt, 'datetime')}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {items.map((item) => {
        const aStatus = auctionStatusMap[item.auction.status] || { variant: 'default' as const, label: item.auction.status };
        return (
          <Card key={item.auction.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/auctions/${item.auction.id}`}
                    className="font-medium hover:text-brand-500"
                  >
                    {item.auction.title}
                  </Link>
                  <Badge variant={aStatus.variant}>{aStatus.label}</Badge>
                  {item.isWinner && (
                    <Badge variant="success">Kazanan</Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div>
                    <span className="text-[var(--muted-foreground)]">Başlangıç: </span>
                    <span className="font-medium">{formatPrice(item.auction.startingPrice)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">Güncel: </span>
                    <span className="font-bold text-brand-500">{formatPrice(item.auction.currentPrice)}</span>
                  </div>
                  {item.highestBid && (
                    <div>
                      <span className="text-[var(--muted-foreground)]">En Yüksek Teklifiniz: </span>
                      <span className="font-medium">{formatPrice(item.highestBid)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[var(--muted-foreground)]">Teklif Sayısı: </span>
                    <span className="font-medium">{item.auction.bidCount}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {formatDate(item.auction.scheduledStart, 'datetime')}
                  {item.auction.endedAt && ` — ${formatDate(item.auction.endedAt, 'datetime')}`}
                </p>
              </div>
              {item.auction.status === 'live' && (
                <Link href={`/auctions/${item.auction.id}`}>
                  <Button size="sm">Katıl</Button>
                </Link>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function DepositsList({ deposits }: { deposits: Deposit[] }) {
  if (deposits.length === 0) {
    return <EmptyState message="Henüz teminat kaydınız yok." />;
  }

  return (
    <div className="mt-6 space-y-3">
      {deposits.map((deposit) => {
        const ds = depositStatusMap[deposit.status] || { variant: 'default' as const, label: deposit.status };
        return (
          <Card key={deposit.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/auctions/${deposit.auctionId}`}
                    className="font-medium hover:text-brand-500"
                  >
                    İhale: {deposit.auctionId.slice(0, 8)}...
                  </Link>
                  <Badge variant={ds.variant}>{ds.label}</Badge>
                </div>
                <p className="mt-1 text-lg font-bold text-brand-500">
                  {formatPrice(deposit.amount)}
                </p>
                <div className="mt-1 flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]">
                  <span>Yöntem: {deposit.paymentMethod}</span>
                  {deposit.posProvider && <span>POS: {deposit.posProvider}</span>}
                  <span>{formatDate(deposit.createdAt, 'datetime')}</span>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
