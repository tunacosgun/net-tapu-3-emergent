'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { Card, LoadingState } from '@/components/ui';
import type { Parcel, ParcelImage } from '@/types';

export default function ParcelDetailPage() {
  const params = useParams<{ id: string }>();
  const parcelId = params.id;

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [images, setImages] = useState<ParcelImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [parcelRes, imagesRes] = await Promise.all([
          apiClient.get<Parcel>(`/parcels/${parcelId}`),
          apiClient.get<ParcelImage[]>(`/parcels/${parcelId}/images`).catch(() => ({ data: [] as ParcelImage[] })),
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-[var(--muted-foreground)]">
        <Link href="/parcels" className="hover:text-brand-500">Arsalar</Link>
        {' / '}
        <span>{parcel.title}</span>
      </nav>

      <h1 className="mt-4 text-3xl font-bold">{parcel.title}</h1>

      <div className="mt-2 text-sm text-[var(--muted-foreground)]">
        {parcel.city}, {parcel.district}
        {parcel.neighborhood ? `, ${parcel.neighborhood}` : ''}
        {parcel.address ? ` — ${parcel.address}` : ''}
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => (
            <img
              key={img.id}
              src={img.url}
              alt={img.caption || parcel.title}
              className="h-48 w-full rounded-lg object-cover border border-[var(--border)]"
            />
          ))}
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
              <span className="text-[var(--muted-foreground)]">Ada / Parsel</span>
              <span className="font-medium">{parcel.ada} / {parcel.parsel}</span>
            </div>
          )}
          {parcel.zoningStatus && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">İmar Durumu</span>
              <span className="font-medium">{parcel.zoningStatus}</span>
            </div>
          )}
          {parcel.landType && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Arazi Türü</span>
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
      <div className="mt-6 flex gap-3">
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
    </div>
  );
}
