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
import { Badge, Card, Alert, Button, LoadingState } from '@/components/ui';
import type { Auction } from '@/types';

function formatTime(ms: number | null): string {
  if (ms === null || ms <= 0) return '00:00:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const auctionId = params.id;
  const userId = useAuthStore((s) => s.user?.sub);

  const {
    auctionDetail,
    auctionLoading,
    auctionError,
    hasActiveDeposit,
    depositLoading,
    depositVersion,
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
    broadcastNameMap,
    timeExtensionAnimation,
    announcements,
    setAuctionDetail,
    setAuctionError,
    setUserDeposit,
    setDepositLoading,
    invalidateDeposit,
    clearTimeExtensionAnimation,
  } = useAuctionStore();

  const [bidAmount, setBidAmount] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
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

  // Turkish auction participation agreement text
  const CONSENT_TEXT = `NetTapu E-İhale Katılım Sözleşmesi

1. İhaleye katılarak, belirlenen teminat (depozito) tutarını ödediğimi ve bu tutarın ihale süresince bloke edileceğini kabul ediyorum.

2. İhaleyi kazanmam durumunda, belirlenen süre içinde kalan ödemeyi tamamlamakla yükümlü olduğumu biliyorum.

3. İhaleyi kazanamamam durumunda, yatırdığım teminat tutarının tarafıma iade edileceğini biliyorum.

4. Verdiğim tekliflerin bağlayıcı olduğunu ve geri alınamayacağını kabul ediyorum.

5. İhale sürecinde hile, manipülasyon veya sistemin kötüye kullanılması durumunda hesabımın askıya alınabileceğini ve teminatımın iade edilmeyebileceğini kabul ediyorum.

6. Kişisel verilerimin 6698 sayılı KVKK kapsamında işleneceğini biliyorum ve onaylıyorum.

7. İhale koşullarını, cayma hakkı politikasını ve tüm satış şartlarını okuduğumu ve kabul ettiğimi beyan ederim.`;

  // 0) If redirected from deposit page, invalidate stale deposit cache
  useEffect(() => {
    if (searchParams.get('depositSuccess') === '1') {
      invalidateDeposit();
      // Strip query param without full reload
      router.replace(`/auctions/${auctionId}`, { scroll: false });
    }
  }, [searchParams, auctionId, router, invalidateDeposit]);

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

  // 2) Fetch participant eligibility from auction-service (single source of truth).
  //    Re-runs when depositVersion bumps (after redirect from deposit page).
  const fetchDeposit = useCallback(async () => {
    if (!userId) {
      setDepositLoading(false);
      return;
    }

    setDepositLoading(true);

    try {
      const { data } = await apiClient.get<{ eligible: boolean; depositStatus: string | null }>(
        `/auctions/${auctionId}/my-participation`,
      );
      // Bridge into existing store shape: eligible + held/collected = active deposit
      setUserDeposit(
        data.eligible
          ? { status: data.depositStatus ?? 'held' } as any
          : null,
      );
    } catch {
      setUserDeposit(null);
    }
  }, [auctionId, userId, setUserDeposit, setDepositLoading]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await fetchDeposit();
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDeposit, depositVersion]);

  // 2b) Check consent status when user has active deposit
  useEffect(() => {
    if (!userId || !hasActiveDeposit) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await apiClient.get<{ hasConsent: boolean; acceptedAt: string | null }>(
          `/auctions/${auctionId}/consent`,
        );
        if (!cancelled) {
          setConsentAccepted(data.hasConsent);
          setConsentChecked(true);
        }
      } catch {
        if (!cancelled) setConsentChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, [auctionId, userId, hasActiveDeposit]);

  // Handle consent acceptance
  async function handleAcceptConsent() {
    setConsentLoading(true);
    try {
      await apiClient.post(`/auctions/${auctionId}/consent`, {
        consentText: CONSENT_TEXT,
      });
      setConsentAccepted(true);
      setShowConsentDialog(false);
    } catch {
      // Show error in UI
    } finally {
      setConsentLoading(false);
    }
  }

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

  // Admin: toggle real names (only for admin)
  async function fetchNameMap(): Promise<Record<string, string>> {
    if (Object.keys(nameMap).length > 0) return nameMap;
    try {
      const { data } = await apiClient.get<
        Array<{ userId: string; userIdMasked: string; fullName: string }>
      >(`/admin/analytics/auctions/${auctionId}/participants`);
      const map: Record<string, string> = {};
      data.forEach((p) => { map[p.userIdMasked] = p.fullName; });
      setNameMap(map);
      return map;
    } catch {
      return {};
    }
  }

  async function handleToggleNames() {
    if (showRealNames) {
      setShowRealNames(false);
      return;
    }
    await fetchNameMap();
    setShowRealNames(true);
  }

  // Admin: broadcast names to everyone via WS
  const [broadcastActive, setBroadcastActive] = useState(false);
  async function handleBroadcastNames() {
    if (broadcastActive) {
      // Turn off — broadcast hide command
      import('@/lib/ws-client').then(({ getSocket }) => {
        const s = getSocket();
        s?.emit('hide_names', { auction_id: auctionId });
      });
      setBroadcastActive(false);
      return;
    }
    const map = await fetchNameMap();
    import('@/lib/ws-client').then(({ getSocket }) => {
      const s = getSocket();
      s?.emit('reveal_names', { auction_id: auctionId, name_map: map });
    });
    setBroadcastActive(true);
    setShowRealNames(true);
  }

  // Auto-fill minimum bid when currentPrice changes
  const minimumIncrement = Number(auctionDetail?.minimumIncrement ?? 0);
  useEffect(() => {
    if (currentPrice != null && minimumIncrement > 0) {
      const minBid = Number(currentPrice) + Number(minimumIncrement);
      setBidAmount(String(minBid));
    }
  }, [currentPrice, minimumIncrement]);

  function handleBid(e: FormEvent) {
    e.preventDefault();
    if (!bidAmount || !currentPrice) return;
    placeBid(auctionId, bidAmount, currentPrice);
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

        {/* Consent gate — deposit paid but consent not yet accepted */}
        {isLive && hasActiveDeposit && consentChecked && !consentAccepted && (
          <Card className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                İhale Katılım Sözleşmesi
              </h3>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Teklif verebilmek için ihale katılım sözleşmesini okumanız ve onaylamanız gerekmektedir.
            </p>
            <Button
              onClick={() => setShowConsentDialog(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Sözleşmeyi Oku ve Onayla
            </Button>
          </Card>
        )}

        {/* Consent dialog/modal */}
        {showConsentDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-[var(--background)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-bold">İhale Katılım Sözleşmesi</h2>
                <button
                  onClick={() => setShowConsentDialog(false)}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl"
                >
                  ✕
                </button>
              </div>

              {/* Consent text */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)] font-sans">
                  {CONSENT_TEXT}
                </pre>
              </div>

              {/* Footer with accept button */}
              <div className="px-6 py-4 border-t border-[var(--border)] space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="consent-checkbox"
                    className="mt-1 h-5 w-5 rounded border-[var(--input)] text-brand-500 focus:ring-brand-500"
                    onChange={(e) => {
                      const checkbox = e.target;
                      if (checkbox.checked) {
                        // Enable accept button
                        const btn = document.getElementById('accept-consent-btn') as HTMLButtonElement;
                        if (btn) btn.disabled = false;
                      } else {
                        const btn = document.getElementById('accept-consent-btn') as HTMLButtonElement;
                        if (btn) btn.disabled = true;
                      }
                    }}
                  />
                  <span className="text-sm font-medium">
                    Yukarıdaki ihale katılım sözleşmesini okudum ve kabul ediyorum.
                  </span>
                </label>

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setShowConsentDialog(false)}
                  >
                    Vazgeç
                  </Button>
                  <Button
                    id="accept-consent-btn"
                    disabled={consentLoading}
                    onClick={handleAcceptConsent}
                    className="bg-brand-500 hover:bg-brand-600 text-white"
                  >
                    {consentLoading ? 'Onaylanıyor...' : 'Okudum, Kabul Ediyorum'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bid form — only if deposit active AND consent accepted */}
        {isLive && hasActiveDeposit && consentAccepted && (
          <div className="space-y-2">
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
            {currentPrice != null && minimumIncrement > 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Minimum teklif: <span className="font-mono font-semibold">{formatPrice(String(Number(currentPrice) + minimumIncrement))}</span>
                {' '}(güncel fiyat + {formatPrice(String(minimumIncrement))} artış)
              </p>
            )}
          </div>
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

      {/* Time extension animation overlay */}
      {timeExtensionAnimation && (
        <TimeExtensionOverlay
          addedMinutes={timeExtensionAnimation.addedMinutes}
          onComplete={clearTimeExtensionAnimation}
        />
      )}

      {/* Admin announcements */}
      {announcements.length > 0 && (
        <div className="lg:col-span-3 space-y-2">
          {announcements.slice(0, 3).map((a, i) => (
            <div
              key={a.timestamp + i}
              className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 animate-bid-flash"
            >
              <svg className="h-5 w-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
              </svg>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{a.message}</p>
              <span className="ml-auto text-xs text-blue-500">
                {new Date(a.timestamp).toLocaleTimeString('tr-TR')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Right column: Bid feed */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Teklif Akışı</h2>
          {isAdmin && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)]">
                İsimleri göster:
              </span>
              <div className="flex items-center gap-1.5">
                {/* Toggle: only admin sees names */}
                <button
                  onClick={handleToggleNames}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    showRealNames
                      ? 'bg-brand-100 text-brand-700 border border-brand-300'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:bg-[var(--accent)]'
                  }`}
                  title="Teklif verenlerin gerçek isimlerini sadece siz görürsünüz. Diğer kullanıcılar etkilenmez."
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Sadece Ben
                </button>
                {/* Broadcast: everyone sees names */}
                <button
                  onClick={handleBroadcastNames}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    broadcastActive
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:bg-[var(--accent)]'
                  }`}
                  title="Teklif verenlerin gerçek isimlerini tüm katılımcılara canlı olarak gösterir. Tekrar basınca gizlenir."
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  Herkese Göster
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2 max-h-[600px] overflow-y-auto">
          {bidFeed.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Henüz teklif yok.
            </p>
          )}
          {bidFeed.map((bid, index) => {
            const revealedName = broadcastNameMap?.[bid.user_id_masked];
            const adminName = showRealNames ? nameMap[bid.user_id_masked] : null;
            const pInfo = getParticipantInfo(bid.user_id_masked);
            const isHighest = index === 0 && !bid.bid_id.startsWith('optimistic-');
            const myMaskedId = userId ? userId.slice(0, 8) + '***' : null;
            const isMe = !!myMaskedId && bid.user_id_masked === myMaskedId;
            const displayName = adminName || revealedName || (isMe ? 'Siz' : pInfo.label);
            const isRevealed = !!(adminName || revealedName);
            const initials = isMe ? '👤' : pInfo.label.replace('Katılımcı ', 'K');
            return (
              <div
                key={bid.bid_id}
                className={`flex items-center justify-between rounded-md px-3 py-2.5 transition-all ${
                  bid.bid_id.startsWith('optimistic-')
                    ? 'opacity-60 border border-dashed border-[var(--border)]'
                    : isHighest
                    ? 'border-2 border-brand-500 bg-brand-50 dark:bg-brand-950/20 shadow-sm animate-bid-flash'
                    : 'border border-[var(--border)] animate-bid-flash'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Avatar */}
                  <div className={`h-8 w-8 rounded-full ${isMe ? 'bg-brand-500' : isRevealed ? 'bg-brand-500' : pInfo.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {isMe ? '👤' : isRevealed ? displayName.charAt(0).toUpperCase() : initials}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm leading-tight ${isRevealed ? 'text-[var(--foreground)] font-medium' : 'text-[var(--foreground)] font-medium'}`}>
                      {displayName}
                    </span>
                    {isHighest && (
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                        En yüksek teklif
                      </span>
                    )}
                  </div>
                </div>
                <span className={`font-mono font-semibold ${isHighest ? 'text-brand-600 dark:text-brand-400 text-lg' : 'text-sm'}`}>
                  {formatPrice(bid.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimeExtensionOverlay({
  addedMinutes,
  onComplete,
}: {
  addedMinutes: number;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 50);
    const t2 = setTimeout(() => setPhase('exit'), 3500);
    const t3 = setTimeout(onComplete, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
      {/* Backdrop pulse */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          phase === 'show' ? 'opacity-30' : 'opacity-0'
        } bg-brand-500`}
      />

      {/* Central card */}
      <div
        className={`relative transform transition-all duration-700 ease-out ${
          phase === 'enter'
            ? 'scale-50 opacity-0'
            : phase === 'show'
            ? 'scale-100 opacity-100'
            : 'scale-110 opacity-0'
        }`}
      >
        <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border-2 border-brand-500 px-12 py-8 text-center space-y-3">
          {/* Clock icon with pulse ring */}
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute h-20 w-20 rounded-full bg-brand-500/20 animate-ping" />
            <div className="relative h-16 w-16 rounded-full bg-brand-500 flex items-center justify-center">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <p className="text-lg font-bold text-[var(--foreground)]">
            Süre Uzatıldı!
          </p>
          <p className="text-4xl font-black text-brand-600 dark:text-brand-400 tabular-nums">
            +{addedMinutes} dakika
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            İhale süresi yönetici tarafından uzatıldı
          </p>
        </div>
      </div>
    </div>
  );
}
