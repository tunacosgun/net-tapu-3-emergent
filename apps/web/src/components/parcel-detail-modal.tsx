'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice, resolveImageUrl } from '@/lib/format';
import { Card, Badge, Button, LoadingState } from '@/components/ui';
import { parcelStatusConfig } from '@/components/ui/badge';
import { ShareButtons } from '@/components/share-buttons';
import { CallMeForm } from '@/components/call-me-form';
import { useSiteSettings } from '@/hooks/use-site-settings';
import type { Parcel, ParcelImage } from '@/types';

interface ParcelDetailModalProps {
  parcelId: string;
  onClose: () => void;
}

export function ParcelDetailModal({ parcelId, onClose }: ParcelDetailModalProps) {
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [images, setImages] = useState<ParcelImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCallMe, setShowCallMe] = useState(false);

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
    return () => { cancelled = true; };
  }, [parcelId]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const siteSettings = useSiteSettings();
  const whatsappNumber = siteSettings.whatsapp_number || '905000000000';
  const parcelUrl = `https://nettapu-demo.tunasoft.tech/parcels/${parcel?.id ?? parcelId}`;
  const lines: string[] = [];
  lines.push('Merhaba,');
  lines.push('A\u015Fa\u011F\u0131daki ilan hakk\u0131nda detayl\u0131 bilgi almak istiyorum.');
  lines.push('');
  lines.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  if (parcel?.listingId) lines.push('\u0130lan No: ' + parcel.listingId);
  if (parcel?.title) lines.push(parcel.title);
  if (parcel?.city && parcel?.district) lines.push('Konum: ' + parcel.city + ', ' + parcel.district);
  if (parcel?.ada && parcel?.parsel) lines.push('Ada / Parsel: ' + parcel.ada + ' / ' + parcel.parsel);
  if (parcel?.areaM2) lines.push('Alan: ' + Number(parcel.areaM2).toLocaleString('tr-TR') + ' m\u00B2');
  if (parcel?.price) lines.push('Fiyat: ' + parseFloat(parcel.price).toLocaleString('tr-TR') + ' \u20BA');
  lines.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  lines.push('');
  lines.push(parcelUrl);
  const whatsappText = lines.join('\n');

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl my-8 rounded-xl bg-[var(--background)] shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
        >
          ✕
        </button>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <LoadingState centered={false} />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {!loading && parcel && (
          <div className="p-6">
            {/* Status + Title */}
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <Badge variant={parcelStatusConfig(parcel.status).variant}>
                  {parcelStatusConfig(parcel.status).label}
                </Badge>
                <h2 className="mt-2 text-2xl font-bold">{parcel.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  📍 {parcel.city}, {parcel.district}
                  {parcel.neighborhood ? `, ${parcel.neighborhood}` : ''}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  İlan No: {parcel.listingId}
                </p>
                {/* Social Proof */}
                {((parcel.favoriteCount ?? 0) > 0 || (parcel.viewerCount ?? 0) > 0) && (
                  <div className="mt-2 flex gap-3 text-xs">
                    {(parcel.favoriteCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-red-500 font-medium">
                        ❤ {parcel.favoriteCount} kişi favoriye aldı
                      </span>
                    )}
                    {(parcel.viewerCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-blue-500 font-medium">
                        👁 {parcel.viewerCount} kişi inceliyor
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Images */}
            {images.length > 0 && (
              <div className="mt-4 grid gap-2 grid-cols-3">
                {images.slice(0, 6).map((img) => (
                  <img
                    key={img.id}
                    src={resolveImageUrl(img)}
                    alt={img.caption || parcel.title}
                    className="h-32 w-full rounded-lg object-cover border border-[var(--border)]"
                  />
                ))}
              </div>
            )}

            {/* Price + Details */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-brand-50 p-4">
                <p className="text-sm text-brand-600">Fiyat</p>
                <p className="text-2xl font-bold text-brand-700">
                  {formatPrice(parcel.price)}
                </p>
                {parcel.pricePerM2 && (
                  <p className="text-sm text-brand-600">
                    {formatPrice(parcel.pricePerM2)} / m²
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-[var(--border)] p-4 space-y-2 text-sm">
                {parcel.areaM2 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Alan</span>
                    <span className="font-medium">
                      {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
                    </span>
                  </div>
                )}
                {parcel.ada && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Ada / Parsel</span>
                    <span className="font-medium">
                      {parcel.ada} / {parcel.parsel}
                    </span>
                  </div>
                )}
                {parcel.zoningStatus && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">İmar</span>
                    <span className="font-medium">{parcel.zoningStatus}</span>
                  </div>
                )}
                {parcel.landType && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Arazi Türü</span>
                    <span className="font-medium">{parcel.landType}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {parcel.description && (
              <div className="mt-4">
                <h3 className="font-semibold text-sm">Açıklama</h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)] whitespace-pre-wrap line-clamp-4">
                  {parcel.description}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--border)] pt-4">
              <Button onClick={() => setShowCallMe(true)} variant="primary" size="sm">
                📞 Sizi Arayalım
              </Button>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
              >
                💬 WhatsApp
              </a>
              <Link
                href={`/parcels/${parcel.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                Detayları Gör →
              </Link>
            </div>

            {/* Share */}
            <div className="mt-4">
              <ShareButtons
                url={typeof window !== 'undefined' ? `${window.location.origin}/parcels/${parcel.id}` : ''}
                title={`${parcel.title} - NetTapu`}
                description={`${parcel.city}, ${parcel.district} - ${formatPrice(parcel.price)}`}
              />
            </div>
          </div>
        )}

        {/* Call Me Form */}
        {showCallMe && parcel && (
          <CallMeForm
            parcelId={parcel.id}
            parcelTitle={parcel.title}
            parcelListingId={parcel.listingId}
            onClose={() => setShowCallMe(false)}
          />
        )}
      </div>
    </div>
  );
}
