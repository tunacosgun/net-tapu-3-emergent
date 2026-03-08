'use client';

import { useEffect, useState } from 'react';

const FEATURE_LABELS: Record<string, string> = {
  full: 'Tüm site erişimi',
  auctions: 'Açık artırmalar',
  parcels: 'Arsa sayfaları',
  bidding: 'Teklif verme',
  messaging: 'İletişim ve mesajlaşma',
};

interface BanScreenProps {
  reason: string;
  restrictedFeatures: string[];
  expiresAt: string | null;
  feature?: string; // which feature triggered this screen
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Süre doldu';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0) parts.push(`${hours} saat`);
  if (minutes > 0) parts.push(`${minutes} dakika`);
  if (seconds > 0 && days === 0) parts.push(`${seconds} saniye`);
  return parts.join(' ') || '0 saniye';
}

export function BanScreen({ reason, restrictedFeatures, expiresAt, feature }: BanScreenProps) {
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining('');
      return;
    }

    function tick() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setExpired(true);
        setRemaining('Süre doldu — sayfayı yenileyin');
      } else {
        setRemaining(formatCountdown(diff));
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (expired) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-green-50 border border-green-200 p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-green-800">Engel Süresi Doldu</h2>
          <p className="mt-2 text-sm text-green-700">
            Erişiminiz tekrar aktif hale geldi. Sayfayı yenileyerek devam edebilirsiniz.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            Sayfayı Yenile
          </button>
        </div>
      </div>
    );
  }

  const isFull = restrictedFeatures.includes('full');
  const title = isFull
    ? 'Hesabınız Engellenmiştir'
    : feature
      ? `${FEATURE_LABELS[feature] || feature} Erişiminiz Kısıtlanmıştır`
      : 'Erişiminiz Kısıtlanmıştır';

  const subtitle = isFull
    ? 'Hesabınıza geçici veya kalıcı olarak erişim engeli uygulanmıştır.'
    : 'Aşağıdaki özellikler için erişiminiz kısıtlanmıştır.';

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl bg-red-50 border border-red-200 p-8 shadow-lg">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-center text-xl font-bold text-red-800">{title}</h2>
        <p className="mt-1 text-center text-sm text-red-600">{subtitle}</p>

        {/* Restricted features */}
        {!isFull && restrictedFeatures.length > 0 && (
          <div className="mt-5 rounded-lg bg-white/70 border border-red-100 p-4">
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-2">Kısıtlanan Özellikler</p>
            <div className="flex flex-wrap gap-2">
              {restrictedFeatures.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
                >
                  {FEATURE_LABELS[f] || f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="mt-5 rounded-lg bg-white/70 border border-red-100 p-4">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">Engel Sebebi</p>
          <p className="text-sm text-red-900">{reason}</p>
        </div>

        {/* Countdown */}
        {expiresAt ? (
          <div className="mt-5 rounded-lg bg-white/70 border border-red-100 p-4 text-center">
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-2">Kalan Süre</p>
            <p className="text-2xl font-bold text-red-800 font-mono">{remaining}</p>
            <p className="mt-1 text-xs text-red-500">
              Bitiş: {new Date(expiresAt).toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-lg bg-white/70 border border-red-100 p-4 text-center">
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">Süre</p>
            <p className="text-lg font-bold text-red-800">Süresiz Engel</p>
          </div>
        )}

        {/* Help text */}
        <p className="mt-5 text-center text-xs text-red-500">
          Bu engelin hatalı olduğunu düşünüyorsanız lütfen destek ekibiyle iletişime geçin.
        </p>
      </div>
    </div>
  );
}
