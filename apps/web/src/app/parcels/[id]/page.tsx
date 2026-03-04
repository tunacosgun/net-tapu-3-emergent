'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { Card, Badge, Button, LoadingState } from '@/components/ui';
import { parcelStatusConfig } from '@/components/ui/badge';
import { ShareButtons } from '@/components/share-buttons';
import { CallMeForm } from '@/components/call-me-form';
import { useViewerTracking } from '@/hooks/use-viewer-tracking';
import type { Parcel, ParcelImage } from '@/types';

export default function ParcelDetailPage() {
  const params = useParams<{ id: string }>();
  const parcelId = params.id;

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [images, setImages] = useState<ParcelImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCallMe, setShowCallMe] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Real-time viewer tracking
  const liveViewerCount = useViewerTracking(parcelId);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [parcelRes, imagesRes] = await Promise.all([
          apiClient.get<Parcel>(`/parcels/${parcelId}`),
          apiClient
            .get<ParcelImage[]>(`/parcels/${parcelId}/images`)
            .catch(() => ({ data: [] as ParcelImage[] })),
        ]);
        if (!cancelled) {
          setParcel(parcelRes.data);
          setImages(imagesRes.data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Arsa bilgisi yüklenemedi.');
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [parcelId]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // SEO: Update page title and JSON-LD (must be before early returns to satisfy rules of hooks)
  useEffect(() => {
    if (parcel) {
      document.title = `${parcel.title} — ${parcel.city}, ${parcel.district} | NetTapu`;

      // JSON-LD Structured Data
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: parcel.title,
        description: parcel.description || `${parcel.city}, ${parcel.district} konumunda arsa`,
        url: window.location.href,
        ...(parcel.price && {
          offers: {
            '@type': 'Offer',
            price: parseFloat(parcel.price),
            priceCurrency: parcel.currency || 'TRY',
            availability: parcel.status === 'active'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/SoldOut',
          },
        }),
        ...(parcel.latitude && parcel.longitude && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: parseFloat(parcel.latitude),
            longitude: parseFloat(parcel.longitude),
          },
        }),
        address: {
          '@type': 'PostalAddress',
          addressLocality: parcel.district,
          addressRegion: parcel.city,
          addressCountry: 'TR',
        },
        ...(parcel.areaM2 && {
          floorSize: {
            '@type': 'QuantitativeValue',
            value: parseFloat(parcel.areaM2),
            unitCode: 'MTK',
          },
        }),
      };

      let script = document.getElementById('json-ld-parcel') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'json-ld-parcel';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);

      return () => {
        script.remove();
      };
    }
  }, [parcel]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingState centered={false} />
      </div>
    );
  }

  if (error || !parcel) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-red-600">{error || 'Arsa bulunamadı.'}</p>
      </div>
    );
  }

  const status = parcelStatusConfig(parcel.status);
  const whatsappNumber = '905000000000'; // TODO: load from SystemSetting
  const whatsappMessage = encodeURIComponent(
    `Merhaba, ${parcel.listingId} nolu ilan (${parcel.title}) hakkında bilgi almak istiyorum.`,
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const tkgmUrl =
    parcel.ada && parcel.parsel
      ? `https://parselsorgu.tkgm.gov.tr/`
      : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 print:px-0 print:py-0">
      {/* Breadcrumb */}
      <nav className="text-sm text-[var(--muted-foreground)] print:hidden">
        <Link href="/parcels" className="hover:text-brand-500">
          Arsalar
        </Link>
        {' / '}
        <span>{parcel.title}</span>
      </nav>

      {/* Title + Status */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{parcel.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            İlan No: {parcel.listingId}
          </p>
        </div>
        <Badge variant={status.variant} className="mt-1 text-sm px-3 py-1">
          {status.label}
        </Badge>
      </div>

      {/* Location */}
      <div className="mt-2 text-sm text-[var(--muted-foreground)]">
        📍 {parcel.city}, {parcel.district}
        {parcel.neighborhood ? `, ${parcel.neighborhood}` : ''}
        {parcel.address ? ` — ${parcel.address}` : ''}
      </div>

      {/* Social Proof: Favorite + Viewer counts */}
      {((parcel.favoriteCount ?? 0) > 0 || liveViewerCount > 0) && (
        <div className="mt-3 flex gap-4 text-sm">
          {(parcel.favoriteCount ?? 0) > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-red-600 font-medium">
              ❤ {parcel.favoriteCount} kişi favoriye aldı
            </span>
          )}
          {liveViewerCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-600 font-medium animate-pulse">
              👁 {liveViewerCount} kişi şu an inceliyor
            </span>
          )}
        </div>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div className="mt-6">
          {/* Main image */}
          {selectedImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 print:hidden"
              onClick={() => setSelectedImage(null)}
            >
              <img
                src={selectedImage}
                alt={parcel.title}
                className="max-h-[90vh] max-w-[90vw] rounded-lg"
              />
              <button
                className="absolute top-4 right-4 text-white text-2xl"
                onClick={() => setSelectedImage(null)}
              >
                ✕
              </button>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <img
                key={img.id}
                src={img.url}
                alt={img.caption || parcel.title}
                onClick={() => setSelectedImage(img.url)}
                className="h-48 w-full rounded-lg object-cover border border-[var(--border)] cursor-pointer hover:opacity-90 transition-opacity"
              />
            ))}
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {/* Price card */}
        <Card className="p-6">
          <p className="text-sm text-[var(--muted-foreground)]">Fiyat</p>
          <p className="mt-1 text-3xl font-bold text-brand-500">
            {formatPrice(parcel.price)}
          </p>
          {parcel.pricePerM2 && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {formatPrice(parcel.pricePerM2)} / m²
            </p>
          )}
        </Card>

        {/* Details card */}
        <Card className="p-6 space-y-3">
          {parcel.areaM2 && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Alan</span>
              <span className="font-medium">
                {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
              </span>
            </div>
          )}
          {parcel.ada && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">
                Ada / Parsel
              </span>
              <span className="font-medium">
                {parcel.ada} / {parcel.parsel}
              </span>
            </div>
          )}
          {parcel.zoningStatus && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">
                İmar Durumu
              </span>
              <span className="font-medium">{parcel.zoningStatus}</span>
            </div>
          )}
          {parcel.landType && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">
                Arazi Türü
              </span>
              <span className="font-medium">{parcel.landType}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">İlan No</span>
            <span className="font-mono text-xs">{parcel.listingId}</span>
          </div>
        </Card>
      </div>

      {/* Description */}
      {parcel.description && (
        <Card className="mt-8 p-6">
          <h2 className="font-semibold">Açıklama</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">
            {parcel.description}
          </p>
        </Card>
      )}

      {/* Badges */}
      <div className="mt-6 flex gap-3 flex-wrap">
        {parcel.isAuctionEligible && (
          <span className="rounded-full bg-brand-50 px-4 py-1 text-sm font-medium text-brand-700">
            Açık Artırmaya Uygun
          </span>
        )}
        {parcel.isFeatured && (
          <span className="rounded-full bg-yellow-50 px-4 py-1 text-sm font-medium text-yellow-700">
            Öne Çıkan İlan
          </span>
        )}
      </div>

      {/* ─── User Actions: Price Alert + Reservation ─── */}
      {parcel.status === 'active' && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 print:hidden">
          {/* Price Drop Alert */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              🔔 Fiyat Düşünce Haber Ver
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Bu arsanın fiyatı düştüğünde size bildirim gönderelim.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={async () => {
                try {
                  await apiClient.post(`/parcels/${parcel.id}/price-alert`, {});
                  alert('Fiyat düşüş bildirimi aktif edildi!');
                } catch {
                  alert('Giriş yapmanız gerekiyor veya zaten abonesiniz.');
                }
              }}
            >
              Bildirim Aç
            </Button>
          </Card>

          {/* 48h Reservation */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              ⏰ Bana Ayır (48 Saat)
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Bu arsayı 48 saat boyunca size ayıralım. Sadece giriş yapan kullanıcılar için.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={async () => {
                try {
                  await apiClient.post(`/parcels/${parcel.id}/reserve`, {});
                  alert('Arsa 48 saat süreyle size ayrıldı!');
                } catch {
                  alert('Giriş yapmanız gerekiyor veya arsa zaten rezerve edilmiş.');
                }
              }}
            >
              Bana Ayır
            </Button>
          </Card>
        </div>
      )}

      {/* ─── Action Buttons ─── */}
      <div className="mt-8 print:hidden">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">İletişim & İşlemler</h2>
          <div className="flex flex-wrap gap-3">
            {/* Sizi Arayalım */}
            <Button onClick={() => setShowCallMe(true)} variant="primary">
              📞 Sizi Arayalım
            </Button>

            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              💬 WhatsApp
            </a>

            {/* Print */}
            <Button onClick={handlePrint} variant="secondary">
              🖨 Yazdır
            </Button>

            {/* TKGM Link */}
            {tkgmUrl && (
              <a
                href={tkgmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                🏛 TKGM Parsel Sorgu
              </a>
            )}
          </div>

          {/* Share */}
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <ShareButtons
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={`${parcel.title} - NetTapu`}
              description={`${parcel.city}, ${parcel.district} - ${formatPrice(parcel.price)}`}
            />
          </div>
        </Card>
      </div>

      {/* "Sizi Arayalım" Modal */}
      {showCallMe && (
        <CallMeForm
          parcelId={parcel.id}
          parcelTitle={parcel.title}
          parcelListingId={parcel.listingId}
          onClose={() => setShowCallMe(false)}
        />
      )}
    </div>
  );
}
