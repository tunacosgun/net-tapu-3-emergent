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
  userId: string;
  userIdMasked: string;
  fullName: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  ipAddress: string | null;
  city: string | null;
  bidCount: number;
  lastBidAt: string | null;
  lastBidAmount: string | null;
}

export default function AdminAuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auctionId = params.id;

  const [auction, setAuction] = useState<Auction | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingStatus, setChangingStatus] = useState(false);
  const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);

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

  // Fetch auction + participants (from admin analytics endpoint)
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [auctionRes, participantsRes] = await Promise.allSettled([
          apiClient.get<Auction>(`/auctions/${auctionId}`),
          apiClient.get<Participant[]>(`/admin/analytics/auctions/${auctionId}/participants`),
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
      setTimeout(() => setExtendConfirm((c) => c === minutes ? null : c), 3000);
    }
  }

  function handleSendAnnouncement() {
    if (!announcementText.trim()) return;
    adminSendAnnouncement(auctionId, announcementText.trim());
    setAnnouncementText('');
  }

  // Build userId -> participant map for bid feed name resolution
  const participantMap = useRef<Record<string, Participant>>({});
  useEffect(() => {
    const map: Record<string, Participant> = {};
    participants.forEach((p) => { map[p.userId] = p; });
    participantMap.current = map;
  }, [participants]);

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
              <Button onClick={handleSendAnnouncement} disabled={!announcementText.trim()}>
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
                    {bidFeed.map((bid, i) => {
                      // Resolve user_id_masked to real name from participant map
                      const p = participantMap.current[bid.user_id_masked];
                      return (
                        <tr
                          key={bid.bid_id}
                          className={`border-b border-[var(--border)] ${i === 0 ? 'bg-brand-50 dark:bg-brand-950/20' : ''}`}
                        >
                          <td className="px-4 py-2 text-[var(--muted-foreground)]">{bidFeed.length - i}</td>
                          <td className="px-4 py-2">
                            <span className="font-medium text-sm">{p?.fullName || bid.user_id_masked}</span>
                            {p && <span className="ml-2 text-xs text-[var(--muted-foreground)]">{p.email}</span>}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-semibold">
                            {formatPrice(bid.amount)}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-[var(--muted-foreground)]">
                            {new Date(bid.server_timestamp).toLocaleTimeString('tr-TR')}
                          </td>
                        </tr>
                      );
                    })}
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
            <div className="max-h-[600px] overflow-y-auto">
              {participants.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-[var(--muted-foreground)]">
                  Henüz katılımcı yok
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {participants.map((p) => (
                    <li
                      key={p.userId}
                      className="relative px-4 py-3 hover:bg-[var(--accent)] transition-colors cursor-pointer"
                      onMouseEnter={() => setHoveredParticipant(p.userId)}
                      onMouseLeave={() => setHoveredParticipant(null)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{p.fullName}</p>
                          <p className="text-xs text-[var(--muted-foreground)] truncate">{p.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {p.bidCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 px-2 py-0.5 text-xs font-bold">
                              {p.bidCount} teklif
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Hover tooltip */}
                      {hoveredParticipant === p.userId && (
                        <div className="absolute left-0 right-0 top-full z-50 mx-2 mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl p-4 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          {/* Header */}
                          <div className="flex items-center gap-3 pb-2 border-b border-[var(--border)]">
                            <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-sm">
                              {p.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{p.fullName}</p>
                              <p className="text-xs text-[var(--muted-foreground)]">ID: {p.userId.slice(0, 12)}...</p>
                            </div>
                          </div>

                          {/* Info grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <InfoItem icon="mail" label="E-posta" value={p.email} />
                            <InfoItem icon="phone" label="Telefon" value={p.phone || 'Belirtilmemiş'} />
                            <InfoItem icon="clock" label="Katılım" value={new Date(p.registeredAt).toLocaleString('tr-TR')} />
                            <InfoItem icon="globe" label="IP Adresi" value={p.ipAddress || 'Bilinmiyor'} />
                            <InfoItem icon="hash" label="Teklif Sayısı" value={String(p.bidCount)} />
                            {p.lastBidAmount && (
                              <InfoItem icon="banknote" label="Son Teklif" value={formatPrice(p.lastBidAmount)} />
                            )}
                            {p.lastBidAt && (
                              <InfoItem icon="timer" label="Son Teklif Zamanı" value={new Date(p.lastBidAt).toLocaleTimeString('tr-TR')} />
                            )}
                          </div>
                        </div>
                      )}
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

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  const icons: Record<string, JSX.Element> = {
    mail: <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />,
    phone: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />,
    clock: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />,
    globe: <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />,
    hash: <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />,
    banknote: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />,
    timer: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />,
  };

  return (
    <div className="flex items-start gap-1.5">
      <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        {icons[icon]}
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">{label}</p>
        <p className="font-medium truncate">{value}</p>
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
