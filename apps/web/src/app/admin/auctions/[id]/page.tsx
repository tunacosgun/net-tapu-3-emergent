'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatPrice } from '@/lib/format';
import { StatCard, Card, PageHeader, Button } from '@/components/ui';
import {
  connectToAuction,
  disconnectFromAuction,
  adminExtendTime,
  adminSendAnnouncement,
} from '@/lib/ws-client';
import { useAuctionStore } from '@/stores/auction-store';
import { useConnectionStore } from '@/stores/connection-store';
import type { Auction } from '@/types';

const statusLabels: Record<string, string> = {
  draft: 'Taslak', scheduled: 'Planlandı', deposit_open: 'Depozito Açık', live: 'CANLI',
  ending: 'Bitiyor', ended: 'Bitti', settling: 'Sonuçlanıyor', settled: 'Sonuçlandı',
  settlement_failed: 'Başarısız', cancelled: 'İptal',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  deposit_open: 'bg-yellow-100 text-yellow-700',
  live: 'bg-green-100 text-green-700',
  ending: 'bg-orange-100 text-orange-700',
  ended: 'bg-gray-200 text-gray-800',
  settling: 'bg-purple-100 text-purple-700',
  settled: 'bg-brand-100 text-brand-700',
  settlement_failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface Participant {
  id: string;
  userId: string;
  eligible: boolean;
  joinedAt: string;
  user?: { firstName?: string; lastName?: string; email?: string };
}

export default function AdminAuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auctionId = params.id;

  const [auction, setAuction] = useState<Auction | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingStatus, setChangingStatus] = useState(false);

  // Admin controls
  const [announcementText, setAnnouncementText] = useState('');
  const [extendConfirm, setExtendConfirm] = useState<number | null>(null);

  // Live WS state
  const wsStatus = useConnectionStore((s) => s.status);
  const currentPrice = useAuctionStore((s) => s.currentPrice);
  const bidCount = useAuctionStore((s) => s.bidCount);
  const participantCount = useAuctionStore((s) => s.participantCount);
  const watcherCount = useAuctionStore((s) => s.watcherCount);
  const timeRemainingMs = useAuctionStore((s) => s.timeRemainingMs);
  const bidFeed = useAuctionStore((s) => s.bidFeed);
  const liveStatus = useAuctionStore((s) => s.status);
  const winnerIdMasked = useAuctionStore((s) => s.winnerIdMasked);
  const finalPrice = useAuctionStore((s) => s.finalPrice);

  // Timer
  const [displayTime, setDisplayTime] = useState<string>('--:--');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeRemainingMs === null || timeRemainingMs <= 0) {
      setDisplayTime(timeRemainingMs === 0 ? '00:00' : '--:--');
      return;
    }
    const endAt = Date.now() + timeRemainingMs;
    function tick() {
      const remaining = Math.max(0, endAt - Date.now());
      const totalSec = Math.ceil(remaining / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setDisplayTime(
        h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeRemainingMs]);

  // Fetch auction + participants
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [auctionRes, participantsRes] = await Promise.allSettled([
          apiClient.get<Auction>(`/auctions/${auctionId}`),
          apiClient.get<Participant[]>(`/auctions/${auctionId}/participants`),
        ]);
        if (cancelled) return;
        if (auctionRes.status === 'fulfilled') setAuction(auctionRes.value.data);
        if (participantsRes.status === 'fulfilled') setParticipants(participantsRes.value.data);
      } catch (err) { showApiError(err); }
      finally { if (!cancelled) setLoading(false); }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [auctionId]);

  // Connect WS — admin always connects for live view
  useEffect(() => {
    if (!auction) return;
    connectToAuction(auctionId);
    return () => disconnectFromAuction();
  }, [auction, auctionId]);

  async function handleStatusChange(newStatus: string) {
    if (!auction) return;
    setChangingStatus(true);
    try {
      const { data } = await apiClient.patch<Auction>(`/auctions/${auctionId}/status`, {
        status: newStatus,
        version: auction.version,
      });
      setAuction(data);
    } catch (err) { showApiError(err); }
    finally { setChangingStatus(false); }
  }

  function handleExtendTime(minutes: number) {
    if (extendConfirm === minutes) {
      adminExtendTime(auctionId, minutes);
      setExtendConfirm(null);
    } else {
      setExtendConfirm(minutes);
      // Auto-cancel confirmation after 3s
      setTimeout(() => setExtendConfirm((c) => c === minutes ? null : c), 3000);
    }
  }

  function handleSendAnnouncement() {
    if (!announcementText.trim()) return;
    adminSendAnnouncement(auctionId, announcementText.trim());
    setAnnouncementText('');
  }

  if (loading) return <TableSkeleton />;
  if (!auction) return <p className="text-red-600">Açık artırma bulunamadı.</p>;

  const effectiveStatus = liveStatus || auction.status;
  const effectivePrice = currentPrice || auction.currentPrice;
  const effectiveBidCount = currentPrice ? bidCount : auction.bidCount;
  const isLive = ['live', 'ending'].includes(effectiveStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        title={auction.title}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => window.open(`/auctions/${auctionId}`, '_blank')}>
              Herkese Açık Sayfa ↗
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>Geri</Button>
          </div>
        }
      />

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-4">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${statusColors[effectiveStatus] || 'bg-gray-100 text-gray-700'}`}>
          {isLive && <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
          {statusLabels[effectiveStatus] || effectiveStatus}
        </span>

        {wsStatus === 'connected' && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> WebSocket Bağlı
          </span>
        )}
        {wsStatus === 'connecting' && (
          <span className="text-xs text-yellow-600">Bağlanıyor...</span>
        )}

        {isLive && (
          <span className="font-mono text-3xl font-bold text-brand-600">{displayTime}</span>
        )}

        <select
          value={auction.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={changingStatus}
          className="ml-auto rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Live stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard size="sm" label="Güncel Fiyat" value={formatPrice(effectivePrice)} />
        <StatCard size="sm" label="Toplam Teklif" value={String(effectiveBidCount)} />
        <StatCard size="sm" label="Katılımcı" value={String(currentPrice ? participantCount : auction.participantCount)} />
        <StatCard size="sm" label="İzleyici" value={String(watcherCount || auction.watcherCount || 0)} />
      </div>

      {/* Admin Control Panel */}
      {isLive && wsStatus === 'connected' && (
        <Card className="border-2 border-brand-500 bg-brand-50/50 dark:bg-brand-950/10 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Canlı Kontrol Paneli
          </h3>

          {/* Time extension */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Süre Uzat</p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 5, 10, 15, 30].map((min) => (
                <button
                  key={min}
                  onClick={() => handleExtendTime(min)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    extendConfirm === min
                      ? 'bg-red-500 text-white ring-2 ring-red-300 scale-105'
                      : 'bg-white dark:bg-gray-800 border border-[var(--border)] hover:border-brand-500 hover:text-brand-600'
                  }`}
                >
                  {extendConfirm === min ? `${min}dk onayla?` : `+${min} dk`}
                </button>
              ))}
            </div>
            {extendConfirm !== null && (
              <p className="text-xs text-red-600 animate-pulse">
                Onaylamak için tekrar tıklayın. Tüm katılımcılar süre uzatma animasyonu görecek.
              </p>
            )}
          </div>

          {/* Announcement */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Duyuru Gönder</p>
            <div className="flex gap-2">
              <input
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAnnouncement()}
                placeholder="Tüm katılımcılara mesaj gönder..."
                className="flex-1 rounded-md border border-[var(--input)] bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              <Button
                onClick={handleSendAnnouncement}
                disabled={!announcementText.trim()}
              >
                Gönder
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bid Feed - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-bold">Teklif Akışı</h3>
              <span className="text-xs text-[var(--muted-foreground)]">{bidFeed.length} teklif</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {bidFeed.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-[var(--muted-foreground)]">
                  Henüz teklif yok
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-[var(--muted-foreground)]">#</th>
                      <th className="px-4 py-2 text-left font-medium text-[var(--muted-foreground)]">Kullanıcı</th>
                      <th className="px-4 py-2 text-right font-medium text-[var(--muted-foreground)]">Tutar</th>
                      <th className="px-4 py-2 text-right font-medium text-[var(--muted-foreground)]">Zaman</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bidFeed.map((bid, i) => (
                      <tr
                        key={bid.bid_id}
                        className={`border-b border-[var(--border)] ${i === 0 ? 'bg-brand-50 dark:bg-brand-950/20' : ''}`}
                      >
                        <td className="px-4 py-2 text-[var(--muted-foreground)]">{bidFeed.length - i}</td>
                        <td className="px-4 py-2 font-mono text-xs">{bid.user_id_masked}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">
                          {formatPrice(bid.amount)}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-[var(--muted-foreground)]">
                          {new Date(bid.server_timestamp).toLocaleTimeString('tr-TR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {/* Auction details */}
          <Card className="space-y-3">
            <h3 className="text-sm font-bold">Detaylar</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Başlangıç Fiyatı" value={formatPrice(auction.startingPrice)} />
              <DetailRow label="Minimum Artış" value={formatPrice(auction.minimumIncrement)} />
              <DetailRow label="Gerekli Depozito" value={formatPrice(auction.requiredDeposit)} />
              <DetailRow label="Uzatma Sayısı" value={String(auction.extensionCount)} />
              <DetailRow label="Versiyon" value={String(auction.version)} />
              {auction.finalPrice && <DetailRow label="Final Fiyat" value={formatPrice(auction.finalPrice)} mono />}
              {(winnerIdMasked || auction.winnerId) && (
                <DetailRow label="Kazanan" value={winnerIdMasked || auction.winnerId || '-'} />
              )}
              {finalPrice && <DetailRow label="Final Fiyat (Live)" value={formatPrice(finalPrice)} mono />}
            </div>
          </Card>

          {/* Dates */}
          <Card className="space-y-2">
            <h3 className="text-sm font-bold">Tarihler</h3>
            <DateRow label="Planlanan Başlangıç" value={auction.scheduledStart} />
            <DateRow label="Planlanan Bitiş" value={auction.scheduledEnd} />
            <DateRow label="Depozito Son Tarih" value={auction.depositDeadline} />
            {auction.actualStart && <DateRow label="Gerçek Başlangıç" value={auction.actualStart} />}
            {auction.endedAt && <DateRow label="Bitti" value={auction.endedAt} />}
            {auction.extendedUntil && <DateRow label="Uzatıldı" value={auction.extendedUntil} />}
          </Card>
        </div>

        {/* Right column: Participants + System */}
        <div className="space-y-4">
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-bold">Katılımcılar</h3>
              <span className="text-xs text-[var(--muted-foreground)]">{participants.length} kişi</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {participants.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-[var(--muted-foreground)]">
                  Henüz katılımcı yok
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {participants.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          {p.user?.firstName
                            ? `${p.user.firstName} ${p.user.lastName || ''}`
                            : p.userId.slice(0, 8) + '...'}
                        </p>
                        {p.user?.email && (
                          <p className="text-xs text-[var(--muted-foreground)]">{p.user.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${p.eligible ? 'bg-green-500' : 'bg-red-400'}`} />
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {new Date(p.joinedAt).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* IDs */}
          <Card className="space-y-1 text-xs text-[var(--muted-foreground)]">
            <h3 className="text-sm font-bold text-[var(--foreground)] mb-2">Sistem Bilgileri</h3>
            <p className="break-all">Auction: {auction.id}</p>
            <p className="break-all">Parcel: {auction.parcelId}</p>
            {auction.winnerId && <p className="break-all">Kazanan: {auction.winnerId}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className={mono ? 'font-mono font-semibold' : ''}>{value}</span>
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
