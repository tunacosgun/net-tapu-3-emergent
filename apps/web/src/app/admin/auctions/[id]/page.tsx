'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatPrice, formatDate } from '@/lib/format';
import { StatCard, Card, PageHeader, Button } from '@/components/ui';
import type { Auction } from '@/types';

const statusLabels: Record<string, string> = {
  draft: 'Taslak', scheduled: 'Planlandı', deposit_open: 'Depozito Açık', live: 'CANLI',
  ending: 'Bitiyor', ended: 'Bitti', settling: 'Sonuçlanıyor', settled: 'Sonuçlandı',
  settlement_failed: 'Başarısız', cancelled: 'İptal',
};

export default function AdminEditAuctionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const { data } = await apiClient.get<Auction>(`/auctions/${params.id}`);
        if (!cancelled) { setAuction(data); setLoading(false); }
      } catch (err) { showApiError(err); setLoading(false); }
    }
    fetch();
    return () => { cancelled = true; };
  }, [params.id]);

  async function handleStatusChange(newStatus: string) {
    if (!auction) return;
    setChangingStatus(true);
    try {
      const { data } = await apiClient.patch<Auction>(`/auctions/${params.id}/status`, {
        status: newStatus,
        version: auction.version,
      });
      setAuction(data);
    } catch (err) { showApiError(err); }
    finally { setChangingStatus(false); }
  }

  if (loading) return <TableSkeleton />;
  if (!auction) return <p className="text-red-600">Açık artırma bulunamadı.</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={auction.title}
        action={
          <Button variant="ghost" onClick={() => router.back()}>Geri</Button>
        }
      />

      {/* Status change */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Durum:</span>
        <select
          value={auction.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={changingStatus}
          className="rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-sm disabled:opacity-50"
        >
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {changingStatus && <span className="text-xs text-[var(--muted-foreground)]">Güncelleniyor...</span>}
      </div>

      {/* Detail cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard size="sm" label="Güncel Fiyat" value={formatPrice(auction.currentPrice)} />
        <StatCard size="sm" label="Başlangıç Fiyatı" value={formatPrice(auction.startingPrice)} />
        <StatCard size="sm" label="Minimum Artış" value={formatPrice(auction.minimumIncrement)} />
        <StatCard size="sm" label="Gerekli Depozito" value={formatPrice(auction.requiredDeposit)} />
        <StatCard size="sm" label="Toplam Teklif" value={String(auction.bidCount)} />
        <StatCard size="sm" label="Katılımcı" value={String(auction.participantCount)} />
        <StatCard size="sm" label="Uzatma Sayısı" value={String(auction.extensionCount)} />
        <StatCard size="sm" label="Versiyon" value={String(auction.version)} />
        {auction.finalPrice && <StatCard size="sm" label="Final Fiyat" value={formatPrice(auction.finalPrice)} />}
      </div>

      {/* Dates */}
      <Card className="space-y-2">
        <h3 className="text-sm font-semibold">Tarihler</h3>
        <DateRow label="Planlanan Başlangıç" value={auction.scheduledStart} />
        <DateRow label="Planlanan Bitiş" value={auction.scheduledEnd} />
        <DateRow label="Depozito Son Tarih" value={auction.depositDeadline} />
        {auction.actualStart && <DateRow label="Gerçek Başlangıç" value={auction.actualStart} />}
        {auction.endedAt && <DateRow label="Bitti" value={auction.endedAt} />}
        {auction.extendedUntil && <DateRow label="Uzatıldı" value={auction.extendedUntil} />}
      </Card>

      {/* IDs */}
      <Card className="space-y-1 text-xs text-[var(--muted-foreground)]">
        <p>Auction ID: {auction.id}</p>
        <p>Parcel ID: {auction.parcelId}</p>
        {auction.winnerId && <p>Kazanan ID: {auction.winnerId}</p>}
      </Card>
    </div>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span>{new Date(value).toLocaleString('tr-TR')}</span>
    </div>
  );
}
