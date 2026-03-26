'use client';

import { useEffect, useRef, useState, useCallback, FormEvent } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
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
import { Badge, Card, Alert, Button, LoadingState, DetailPageSkeleton } from '@/components/ui';
import type { Auction, Parcel, ParcelImage } from '@/types';

/* ─── helpers ─── */

function formatTime(ms: number | null): string {
  if (ms === null || ms <= 0) return '00:00:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (d > 0) return `${d} Gün ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatArea(m2: string | null) {
  if (!m2) return null;
  const n = Number(m2);
  if (n >= 10000) return `${(n / 10000).toFixed(1)} Hektar`;
  if (n >= 1000) return `${Math.round(n / 1000)} Dönüm`;
  return `${Math.round(n)} m²`;
}

const statusLabels: Record<string, string> = {
  draft: 'Taslak', scheduled: 'Planlandı', deposit_open: 'Depozito Açık',
  live: 'CANLI', ending: 'Bitiyor', ended: 'Bitti',
  settling: 'Sonuçlanıyor', settled: 'Sonuçlandı', cancelled: 'İptal Edildi',
};

const statusColors: Record<string, string> = {
  live: 'bg-auction-live', ending: 'bg-auction-ending', scheduled: 'bg-auction-scheduled',
  deposit_open: 'bg-blue-500', ended: 'bg-auction-ended', settled: 'bg-auction-ended',
};

/* ─── main page ─── */

export default function AuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const auctionId = params.id;
  const userId = useAuthStore((s) => s.user?.sub);
  const myAvatarUrl = useAuthStore((s) => s.avatarUrl);
  const showAvatarInAuction = useAuthStore((s) => s.showAvatarInAuction);

  const {
    auctionDetail, auctionLoading, auctionError, userDeposit, hasActiveDeposit, depositLoading,
    depositVersion, status, currentPrice, bidCount, participantCount, watcherCount,
    timeRemainingMs, bidFeed, lastRejection, winnerIdMasked, finalPrice,
    broadcastNameMap, usernameMap, timeExtensionAnimation, announcements,
    setAuctionDetail, setAuctionError, setUserDeposit, setDepositLoading,
    invalidateDeposit, clearTimeExtensionAnimation,
  } = useAuctionStore();

  const [bidAmount, setBidAmount] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [parcel, setParcel] = useState<(Parcel & { images?: ParcelImage[] }) | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Anonymous participant label & color mapping
  const participantLabelMap = useRef<Record<string, { label: string; color: string }>>({});
  const participantCounter = useRef(0);
  const AVATAR_COLORS = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-rose-500',
    'bg-indigo-500', 'bg-teal-500', 'bg-lime-500', 'bg-fuchsia-500',
  ];
  function getParticipantInfo(maskedId: string) {
    if (!participantLabelMap.current[maskedId]) {
      participantCounter.current += 1;
      const num = participantCounter.current;
      participantLabelMap.current[maskedId] = {
        label: `Katılımcı ${num}`,
        color: AVATAR_COLORS[(num - 1) % AVATAR_COLORS.length],
      };
    }
    return participantLabelMap.current[maskedId];
  }

  // Admin: reveal real names
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin');
  const [showRealNames, setShowRealNames] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const [contractHtml, setContractHtml] = useState<string | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [rulesHtml, setRulesHtml] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showRulesPopup, setShowRulesPopup] = useState(false);
  const [showContractPopup, setShowContractPopup] = useState(false);

  const CONSENT_TEXT = `NetTapu E-İhale Katılım Sözleşmesi\n\n1. İhaleye katılarak, belirlenen teminat (depozito) tutarını ödediğimi ve bu tutarın ihale süresince bloke edileceğini kabul ediyorum.\n\n2. İhaleyi kazanmam durumunda, belirlenen süre içinde kalan ödemeyi tamamlamakla yükümlü olduğumu biliyorum.\n\n3. İhaleyi kazanamamam durumunda, yatırdığım teminat tutarının tarafıma iade edileceğini biliyorum.\n\n4. Verdiğim tekliflerin bağlayıcı olduğunu ve geri alınamayacağını kabul ediyorum.\n\n5. İhale sürecinde hile, manipülasyon veya sistemin kötüye kullanılması durumunda hesabımın askıya alınabileceğini ve teminatımın iade edilmeyebileceğini kabul ediyorum.\n\n6. Kişisel verilerimin 6698 sayılı KVKK kapsamında işleneceğini biliyorum ve onaylıyorum.\n\n7. İhale koşullarını, cayma hakkı politikasını ve tüm satış şartlarını okuduğumu ve kabul ettiğimi beyan ederim.`;

  // Fetch contract from CMS for consent dialog
  async function fetchContractContent() {
    if (contractHtml) return;
    setContractLoading(true);
    try {
      const { data } = await apiClient.get<{ data: Array<{ content: string }> }>('/content/pages', {
        params: { pageType: 'auction_contract', status: 'published' },
      });
      const page = data.data[0];
      if (page?.content) {
        try {
          const blocks = JSON.parse(page.content);
          if (Array.isArray(blocks)) {
            const html = blocks
              .map((b: Record<string, unknown>) => {
                const c = b.data && typeof b.data === 'object' ? (b.data as Record<string, unknown>).content : b.content;
                return typeof c === 'string' ? c : '';
              })
              .join('');
            setContractHtml(html);
          }
        } catch { /* fallback to CONSENT_TEXT */ }
      }
    } catch { /* fallback to CONSENT_TEXT */ }
    finally { setContractLoading(false); }
  }

  async function fetchRulesContent() {
    if (rulesHtml) return;
    setRulesLoading(true);
    try {
      const { data } = await apiClient.get<{ data: Array<{ content: string }> }>('/content/pages', {
        params: { pageType: 'auction_rules', status: 'published' },
      });
      const page = data.data[0];
      if (page?.content) {
        try {
          const blocks = JSON.parse(page.content);
          if (Array.isArray(blocks)) {
            const html = blocks
              .map((b: Record<string, unknown>) => {
                const c = b.data && typeof b.data === 'object' ? (b.data as Record<string, unknown>).content : b.content;
                return typeof c === 'string' ? c : '';
              })
              .join('');
            setRulesHtml(html);
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setRulesLoading(false); }
  }

  // 0) If redirected from deposit page
  useEffect(() => {
    if (searchParams.get('depositSuccess') === '1') {
      invalidateDeposit();
      router.replace(`/auctions/${auctionId}`, { scroll: false });
    }
  }, [searchParams, auctionId, router, invalidateDeposit]);

  // 1) Fetch auction detail
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

  // 1b) Fetch parcel data when auction loads
  useEffect(() => {
    if (!auctionDetail?.parcelId) return;
    let cancelled = false;
    apiClient.get<Parcel & { images?: ParcelImage[] }>(`/parcels/${auctionDetail.parcelId}`)
      .then(({ data }) => { if (!cancelled) setParcel(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [auctionDetail?.parcelId]);

  // 2) Fetch deposit
  const fetchDeposit = useCallback(async () => {
    if (!userId) { setDepositLoading(false); return; }
    setDepositLoading(true);
    try {
      const { data } = await apiClient.get<{ eligible: boolean; depositStatus: string | null }>(
        `/auctions/${auctionId}/my-participation`,
      );
      if (data.eligible) {
        setUserDeposit({ status: data.depositStatus ?? 'held' } as any);
      } else if (data.depositStatus) {
        // User has a deposit but not yet approved (e.g. pending bank transfer)
        setUserDeposit({ status: data.depositStatus } as any);
      } else {
        setUserDeposit(null);
      }
    } catch { setUserDeposit(null); }
  }, [auctionId, userId, setUserDeposit, setDepositLoading]);

  useEffect(() => {
    fetchDeposit();
  }, [fetchDeposit, depositVersion]);

  // 2b) Check consent
  useEffect(() => {
    if (!userId || !hasActiveDeposit) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get<{ hasConsent: boolean }>(`/auctions/${auctionId}/consent`);
        if (!cancelled) { setConsentAccepted(data.hasConsent); setConsentChecked(true); }
      } catch { if (!cancelled) setConsentChecked(true); }
    })();
    return () => { cancelled = true; };
  }, [auctionId, userId, hasActiveDeposit]);

  async function handleAcceptConsent() {
    setConsentLoading(true);
    try {
      await apiClient.post(`/auctions/${auctionId}/consent`, { consentText: CONSENT_TEXT });
      setConsentAccepted(true);
      setShowConsentDialog(false);
    } catch {} finally { setConsentLoading(false); }
  }

  // 3) WS
  useEffect(() => {
    if (auctionLoading || auctionError) return;
    connectToAuction(auctionId);
    return () => disconnectFromAuction();
  }, [auctionId, auctionLoading, auctionError]);

  // 4) Timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeRemainingMs && timeRemainingMs > 0) {
      const startedAt = Date.now();
      const initialMs = timeRemainingMs;
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, initialMs - (Date.now() - startedAt));
        useAuctionStore.getState().setTimeRemaining(remaining);
        if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current);
      }, 250);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeRemainingMs]);

  // Admin name map
  async function fetchNameMap(): Promise<Record<string, string>> {
    if (Object.keys(nameMap).length > 0) return nameMap;
    try {
      const { data } = await apiClient.get<Array<{ userId: string; userIdMasked: string; fullName: string }>>(`/admin/analytics/auctions/${auctionId}/participants`);
      const map: Record<string, string> = {};
      data.forEach((p) => { map[p.userIdMasked] = p.fullName; });
      setNameMap(map);
      return map;
    } catch { return {}; }
  }

  async function handleToggleNames() {
    if (showRealNames) { setShowRealNames(false); return; }
    await fetchNameMap();
    setShowRealNames(true);
  }

  const [broadcastActive, setBroadcastActive] = useState(false);
  async function handleBroadcastNames() {
    if (broadcastActive) {
      import('@/lib/ws-client').then(({ getSocket }) => { getSocket()?.emit('hide_names', { auction_id: auctionId }); });
      setBroadcastActive(false);
      return;
    }
    const map = await fetchNameMap();
    import('@/lib/ws-client').then(({ getSocket }) => { getSocket()?.emit('reveal_names', { auction_id: auctionId, name_map: map }); });
    setBroadcastActive(true);
    setShowRealNames(true);
  }

  // Auto-fill minimum bid
  const minimumIncrement = Number(auctionDetail?.minimumIncrement ?? 0);
  useEffect(() => {
    if (currentPrice != null && minimumIncrement > 0) setBidAmount(String(Number(currentPrice) + Number(minimumIncrement)));
  }, [currentPrice, minimumIncrement]);

  function handleBid(e: FormEvent) {
    e.preventDefault();
    if (!bidAmount || !currentPrice) return;
    placeBid(auctionId, bidAmount, currentPrice);
  }

  // User ranking
  const myMaskedId = userId ? userId.slice(0, 8) + '***' : null;
  const myRank = myMaskedId ? bidFeed.findIndex((b) => b.user_id_masked === myMaskedId) + 1 : 0;
  const myHighestBid = myMaskedId ? bidFeed.find((b) => b.user_id_masked === myMaskedId) : null;

  // Share
  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: auctionDetail?.title || 'İhale', url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  // Favorite toggle
  async function toggleFavorite() {
    if (!parcel) return;
    try {
      if (isFavorite) {
        await apiClient.delete(`/favorites/${parcel.id}`);
        setIsFavorite(false);
      } else {
        await apiClient.post('/favorites', { parcelId: parcel.id });
        setIsFavorite(true);
      }
    } catch {}
  }

  const isLive = status === 'live' || status === 'ending';
  const parcelImages = parcel?.images?.filter((i) => i.status === 'ready') ?? [];
  const coverImage = parcelImages.find((i) => i.isCover) || parcelImages[0];

  if (auctionLoading) return <DetailPageSkeleton />;
  if (auctionError) return <div className="flex min-h-[400px] items-center justify-center"><p className="text-red-600">{auctionError}</p></div>;

  return (
    <div className="space-y-6">
      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.slice(0, 3).map((a, i) => (
            <div key={a.timestamp + i} className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 animate-bid-flash">
              <svg className="h-5 w-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
              </svg>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{a.message}</p>
              <span className="ml-auto text-xs text-blue-500">{new Date(a.timestamp).toLocaleTimeString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Parcel Hero Section ── */}
      {parcel && (
        <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
          {/* Compact parcel thumbnail + action buttons */}
          {parcelImages.length > 0 && (
            <div className="relative h-[120px] bg-gray-100 dark:bg-gray-800 flex items-center">
              <img
                src={coverImage?.watermarkedUrl || coverImage?.originalUrl}
                alt={parcel.title}
                className="h-full w-full object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-between px-5">
                <div className="flex items-center gap-3">
                  <img src={coverImage?.thumbnailUrl || coverImage?.watermarkedUrl || coverImage?.originalUrl} alt="" className="h-16 w-24 rounded-lg object-cover border-2 border-white/30" />
                  <div>
                    <p className="text-white font-semibold text-sm">{parcel.title?.slice(0, 40)}{(parcel.title?.length || 0) > 40 ? '...' : ''}</p>
                    <p className="text-white/70 text-xs mt-0.5">{parcel.city} / {parcel.district}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowGallery(true); setTimeout(() => document.getElementById('auction-gallery')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 backdrop-blur-sm px-3 py-2 text-xs font-medium text-white hover:bg-white/30 transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                    Fotoğraflar ({parcelImages.length})
                  </button>
                  <button onClick={toggleFavorite} className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${isFavorite ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                    <svg className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                  </button>
                  <button onClick={handleShare} className="h-9 w-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Parcel info bar */}
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                {parcel.city} / {parcel.district}
              </span>
              {parcel.areaM2 && (
                <span className="flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950/30 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                  📐 {formatArea(parcel.areaM2)}
                </span>
              )}
              {parcel.zoningStatus && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  🏗 {parcel.zoningStatus}
                </span>
              )}
              {parcel.ada && parcel.parsel && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  🧾 Ada: {parcel.ada} / Parsel: {parcel.parsel}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/parcels/${parcel.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 bg-brand-50 dark:bg-brand-950/20 px-4 py-2 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-100 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                Arsa Detayları
              </Link>
              {parcel.latitude && parcel.longitude && (
                <a href={`https://www.google.com/maps/@${parcel.latitude},${parcel.longitude},17z`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
                  <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>
                  Haritada Gör
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status + Timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={`${statusColors[status ?? ''] || 'bg-gray-400'} text-white`}>
                {statusLabels[status ?? ''] || status}
              </Badge>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-2xl font-mono font-bold">{formatTime(timeRemainingMs)}</span>
              </div>
            </div>
            <ConnectionStatus />
          </div>

          {/* Title */}
          {auctionDetail && <h1 className="text-2xl font-bold">{auctionDetail.title}</h1>}

          {/* Current price card */}
          <Card className="p-6">
            <p className="text-sm text-[var(--muted-foreground)]">Güncel Fiyat</p>
            <p className="mt-1 text-4xl font-bold text-brand-500">{formatPrice(currentPrice)}</p>
            <div className="mt-4 flex gap-6 text-sm text-[var(--muted-foreground)]">
              <span>{bidCount} teklif</span>
              <span>{participantCount} katılımcı</span>
              <span>{watcherCount} izleyici</span>
            </div>
          </Card>

          {/* Auction info box */}
          {auctionDetail && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                İhale Bilgileri
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Başlangıç Fiyatı</p>
                  <p className="font-semibold font-mono">{formatPrice(auctionDetail.startingPrice)}</p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Min. Artış</p>
                  <p className="font-semibold font-mono">{formatPrice(auctionDetail.minimumIncrement)}</p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Teminat Bedeli</p>
                  <p className="font-semibold font-mono">{formatPrice(auctionDetail.requiredDeposit)}</p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Başlangıç Tarihi</p>
                  <p className="font-semibold">{new Date(auctionDetail.scheduledStart).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Bitiş Tarihi</p>
                  <p className="font-semibold">{new Date(auctionDetail.scheduledEnd).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Katılımcı</p>
                  <p className="font-semibold">{participantCount} kişi</p>
                </div>
              </div>
              {/* Anti-sniping info */}
              <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <span><strong>Anti-Sniping:</strong> Son 2 dakikada teklif gelirse süre otomatik olarak 2 dakika uzatılır.</span>
              </div>
            </Card>
          )}

          {/* User ranking */}
          {isLive && myHighestBid && (
            <Card className="p-4 border-brand-200 bg-brand-50/50 dark:bg-brand-950/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${myRank === 1 ? 'bg-brand-500' : 'bg-gray-400'}`}>
                    #{myRank}
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)]">Sıralamanız</p>
                    <p className="font-semibold">{myRank === 1 ? '🏆 En yüksek teklif sizde!' : `${myRank}. sıradasınız`}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--muted-foreground)]">Teklifiniz</p>
                  <p className="font-mono font-bold text-brand-600">{formatPrice(myHighestBid.amount)}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Deposit gating */}
          {isLive && !depositLoading && !hasActiveDeposit && userDeposit?.status && ['pending', 'awaiting_confirmation', 'awaiting_3ds'].includes(userDeposit.status) && (
            <Alert variant="info" className="space-y-2">
              <p className="font-semibold">Havale / EFT bildirimi alındı</p>
              <p className="text-xs">Ödemeniz admin tarafından inceleniyor. Onaylandığında teklif verebilirsiniz.</p>
            </Alert>
          )}
          {isLive && !depositLoading && !hasActiveDeposit && (!userDeposit || !['pending', 'awaiting_confirmation', 'awaiting_3ds'].includes(userDeposit?.status ?? '')) && (
            <Alert variant="warning" className="space-y-2">
              <p className="font-semibold">Teklif verebilmek için depozito yatırmanız gerekiyor.</p>
              <p className="text-xs">Gerekli depozito: {formatPrice(auctionDetail?.requiredDeposit ?? null)}</p>
              <Link href={`/auctions/${auctionId}/deposit`} className="mt-3 inline-block rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700 transition-colors">
                Depozito Yatır
              </Link>
            </Alert>
          )}

          {/* Consent gate */}
          {isLive && hasActiveDeposit && consentChecked && !consentAccepted && (
            <Card className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">İhale Katılım Sözleşmesi</h3>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">Teklif verebilmek için ihale katılım sözleşmesini okumanız ve onaylamanız gerekmektedir.</p>
              <Button onClick={() => { setShowConsentDialog(true); fetchContractContent(); }} className="bg-amber-600 hover:bg-amber-700 text-white">Sözleşmeyi Oku ve Onayla</Button>
            </Card>
          )}

          {/* Consent dialog */}
          {showConsentDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-[var(--background)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="text-lg font-bold">İhale Katılım Sözleşmesi</h2>
                  <button onClick={() => setShowConsentDialog(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {contractLoading ? (
                    <div className="flex items-center justify-center py-8"><LoadingState centered={false} /></div>
                  ) : contractHtml ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-[var(--foreground)] prose-headings:font-bold prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-p:text-[var(--muted-foreground)] prose-p:leading-relaxed prose-ul:text-[var(--muted-foreground)] prose-li:marker:text-brand-400 prose-strong:text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: contractHtml }} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)] font-sans">{CONSENT_TEXT}</pre>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-[var(--border)] space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" id="consent-checkbox" className="mt-1 h-5 w-5 rounded border-[var(--input)] text-brand-500 focus:ring-brand-500" onChange={(e) => { const btn = document.getElementById('accept-consent-btn') as HTMLButtonElement; if (btn) btn.disabled = !e.target.checked; }} />
                    <span className="text-sm font-medium">Yukarıdaki ihale katılım sözleşmesini okudum ve kabul ediyorum.</span>
                  </label>
                  <div className="flex gap-3 justify-end">
                    <Button variant="secondary" onClick={() => setShowConsentDialog(false)}>Vazgeç</Button>
                    <Button id="accept-consent-btn" disabled={consentLoading} onClick={handleAcceptConsent} className="bg-brand-500 hover:bg-brand-600 text-white">{consentLoading ? 'Onaylanıyor...' : 'Okudum, Kabul Ediyorum'}</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rules popup */}
          {showRulesPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-[var(--background)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="text-lg font-bold">Açık Artırma Kuralları</h2>
                  <button onClick={() => setShowRulesPopup(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {rulesLoading ? (
                    <div className="flex items-center justify-center py-8"><LoadingState centered={false} /></div>
                  ) : rulesHtml ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-[var(--foreground)] prose-headings:font-bold prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-p:text-[var(--muted-foreground)] prose-p:leading-relaxed prose-ul:text-[var(--muted-foreground)] prose-li:marker:text-brand-400 prose-strong:text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: rulesHtml }} />
                  ) : (
                    <p className="text-sm text-[var(--muted-foreground)]">Kurallar yüklenemedi.</p>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end">
                  <Button variant="secondary" onClick={() => setShowRulesPopup(false)}>Kapat</Button>
                </div>
              </div>
            </div>
          )}

          {/* Contract popup */}
          {showContractPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-[var(--background)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="text-lg font-bold">İhale Katılım Sözleşmesi</h2>
                  <button onClick={() => setShowContractPopup(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {contractLoading ? (
                    <div className="flex items-center justify-center py-8"><LoadingState centered={false} /></div>
                  ) : contractHtml ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-[var(--foreground)] prose-headings:font-bold prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-p:text-[var(--muted-foreground)] prose-p:leading-relaxed prose-ul:text-[var(--muted-foreground)] prose-li:marker:text-brand-400 prose-strong:text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: contractHtml }} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)] font-sans">{CONSENT_TEXT}</pre>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end">
                  <Button variant="secondary" onClick={() => setShowContractPopup(false)}>Kapat</Button>
                </div>
              </div>
            </div>
          )}

          {/* Bid form */}
          {isLive && hasActiveDeposit && consentAccepted && (
            <div className="space-y-2">
              <form onSubmit={handleBid} className="flex gap-3">
                <input type="number" step="any" min="0" placeholder="Teklif tutarı (TRY)" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} className="flex-1 rounded-md border border-[var(--input)] bg-[var(--background)] px-4 py-3 text-lg font-mono shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <Button size="lg" disabled={!bidAmount} type="submit">Teklif Ver</Button>
              </form>
              {currentPrice != null && minimumIncrement > 0 && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Minimum teklif: <span className="font-mono font-semibold">{formatPrice(String(Number(currentPrice) + minimumIncrement))}</span> (güncel fiyat + {formatPrice(String(minimumIncrement))} artış)
                </p>
              )}
            </div>
          )}

          {/* Rejection */}
          {lastRejection && <Alert>{lastRejection.message}</Alert>}

          {/* Ended state */}
          {status === 'ended' && winnerIdMasked && (
            <div className="rounded-lg border-2 border-brand-500 p-6 text-center">
              <p className="text-lg font-semibold">Açık Artırma Sona Erdi</p>
              <p className="mt-2 text-3xl font-bold text-brand-500">{formatPrice(finalPrice)}</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Kazanan: {winnerIdMasked}</p>
            </div>
          )}

          {/* Description */}
          {auctionDetail?.description && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Açıklama</h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{auctionDetail.description}</p>
            </Card>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              </div>
              <div><p className="text-xs font-semibold">Tapu Doğrulandı</p></div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
              </div>
              <div><p className="text-xs font-semibold">İmar Kontrol</p></div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-4.52 1.772 6.003 6.003 0 01-4.52-1.772" /></svg>
              </div>
              <div><p className="text-xs font-semibold">NetTapu Garantisi</p></div>
            </div>
          </div>

          {/* Map preview */}
          {parcel?.latitude && parcel?.longitude && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-[var(--border)]">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                  Konum
                </h3>
              </div>
              <a href={`https://www.google.com/maps/@${parcel.latitude},${parcel.longitude},17z`} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${parcel.latitude},${parcel.longitude}&zoom=15&size=800x300&maptype=satellite&markers=color:red%7C${parcel.latitude},${parcel.longitude}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`}
                  alt="Konum"
                  className="w-full h-[200px] object-cover hover:opacity-90 transition-opacity"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </a>
            </Card>
          )}

          {/* Auction rules link */}
          <div className="text-center space-x-4">
            <button onClick={() => { setShowRulesPopup(true); fetchRulesContent(); }} className="text-sm text-[var(--muted-foreground)] hover:text-brand-500 transition-colors underline underline-offset-4">
              Açık artırma kurallarını oku →
            </button>
            <button onClick={() => { setShowContractPopup(true); fetchContractContent(); }} className="text-sm text-[var(--muted-foreground)] hover:text-brand-500 transition-colors underline underline-offset-4">
              İhale katılım sözleşmesi →
            </button>
          </div>
        </div>

        {/* Right column: Bid feed */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Teklif Akışı</h2>
            {isAdmin && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-[var(--muted-foreground)]">İsimleri göster:</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={handleToggleNames} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${showRealNames ? 'bg-brand-100 text-brand-700 border border-brand-300' : 'bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:bg-[var(--accent)]'}`} title="Sadece siz görürsünüz">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                    Sadece Ben
                  </button>
                  <button onClick={handleBroadcastNames} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${broadcastActive ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:bg-[var(--accent)]'}`} title="Herkese göster">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                    Herkese Göster
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 space-y-2 max-h-[600px] overflow-y-auto">
            {bidFeed.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">Henüz teklif yok.</p>}
            {bidFeed.map((bid, index) => {
              const revealedName = broadcastNameMap?.[bid.user_id_masked];
              const adminName = showRealNames ? nameMap[bid.user_id_masked] : null;
              const pInfo = getParticipantInfo(bid.user_id_masked);
              const isHighest = index === 0 && !bid.bid_id.startsWith('optimistic-');
              const isMe = !!myMaskedId && bid.user_id_masked === myMaskedId;
              const latestUsername = usernameMap[bid.user_id_masked];
              const displayName = adminName || revealedName || (isMe ? 'Siz' : latestUsername ? `@${latestUsername}` : pInfo.label);
              const isRevealed = !!(adminName || revealedName);
              const hasUsername = !!latestUsername && !isMe && !adminName && !revealedName;
              const initials = isMe ? '👤' : hasUsername ? latestUsername.charAt(0).toUpperCase() : pInfo.label.replace('Katılımcı ', 'K');
              return (
                <div key={bid.bid_id} className={`flex items-center justify-between rounded-md px-3 py-2.5 transition-all ${bid.bid_id.startsWith('optimistic-') ? 'opacity-60 border border-dashed border-[var(--border)]' : isHighest ? 'border-2 border-brand-500 bg-brand-50 dark:bg-brand-950/20 shadow-sm animate-bid-flash' : 'border border-[var(--border)] animate-bid-flash'}`}>
                  <div className="flex items-center gap-2.5">
                    {isMe && showAvatarInAuction && myAvatarUrl ? (
                      <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-brand-500">
                        <img src={myAvatarUrl} alt="Siz" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className={`h-8 w-8 rounded-full ${isMe ? 'bg-brand-500' : isRevealed ? 'bg-brand-500' : pInfo.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {isMe ? '👤' : isRevealed ? displayName.charAt(0).toUpperCase() : initials}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm leading-tight text-[var(--foreground)] font-medium">{displayName}</span>
                        {isMe && isAdmin && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 leading-none">
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                            Yönetici
                          </span>
                        )}
                      </div>
                      {isHighest && <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">En yüksek teklif</span>}
                    </div>
                  </div>
                  <span className={`font-mono font-semibold ${isHighest ? 'text-brand-600 dark:text-brand-400 text-lg' : 'text-sm'}`}>{formatPrice(bid.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time extension animation */}
      {timeExtensionAnimation && <TimeExtensionOverlay addedMinutes={timeExtensionAnimation.addedMinutes} onComplete={clearTimeExtensionAnimation} />}
    </div>
  );
}

function TimeExtensionOverlay({ addedMinutes, onComplete }: { addedMinutes: number; onComplete: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 50);
    const t2 = setTimeout(() => setPhase('exit'), 3500);
    const t3 = setTimeout(onComplete, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
      <div className={`absolute inset-0 transition-opacity duration-500 ${phase === 'show' ? 'opacity-30' : 'opacity-0'} bg-brand-500`} />
      <div className={`relative transform transition-all duration-700 ease-out ${phase === 'enter' ? 'scale-50 opacity-0' : phase === 'show' ? 'scale-100 opacity-100' : 'scale-110 opacity-0'}`}>
        <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border-2 border-brand-500 px-12 py-8 text-center space-y-3">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute h-20 w-20 rounded-full bg-brand-500/20 animate-ping" />
            <div className="relative h-16 w-16 rounded-full bg-brand-500 flex items-center justify-center">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <p className="text-lg font-bold text-[var(--foreground)]">Süre Uzatıldı!</p>
          <p className="text-4xl font-black text-brand-600 dark:text-brand-400 tabular-nums">+{addedMinutes} dakika</p>
          <p className="text-sm text-[var(--muted-foreground)]">İhale süresi yönetici tarafından uzatıldı</p>
        </div>
      </div>

      {/* ── Photo Gallery (bottom, toggleable) ── */}
      {showGallery && parcelImages.length > 0 && (
        <div id="auction-gallery" className="rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
              <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              Arsa Fotoğrafları ({parcelImages.length})
            </h3>
            <button onClick={() => setShowGallery(false)} className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Kapat
            </button>
          </div>
          {/* Main image */}
          <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3">
            <img
              src={parcelImages[galleryIndex]?.watermarkedUrl || parcelImages[galleryIndex]?.originalUrl}
              alt={parcel?.title || ''}
              className="w-full h-[400px] lg:h-[500px] object-cover"
            />
            {parcelImages.length > 1 && (
              <>
                <button onClick={() => setGalleryIndex((i) => (i - 1 + parcelImages.length) % parcelImages.length)} className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <button onClick={() => setGalleryIndex((i) => (i + 1) % parcelImages.length)} className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
              </>
            )}
            <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white font-medium">
              {galleryIndex + 1}/{parcelImages.length}
            </div>
          </div>
          {/* Thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {parcelImages.map((img, i) => (
              <button key={img.id} onClick={() => setGalleryIndex(i)} className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${i === galleryIndex ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <img src={img.thumbnailUrl || img.watermarkedUrl || img.originalUrl} alt="" className="h-16 w-24 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
