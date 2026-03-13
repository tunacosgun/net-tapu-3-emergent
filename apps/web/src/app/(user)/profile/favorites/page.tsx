'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice, resolveImageUrl } from '@/lib/format';
import { Card, Button, Alert, EmptyState, LoadingState, Badge } from '@/components/ui';
import { parcelStatusConfig } from '@/components/ui/badge';
import { showApiError } from '@/components/api-error-toast';
import type { Parcel } from '@/types';

interface FavoriteItem {
  id: string;
  parcelId: string;
  createdAt: string;
  parcel?: Parcel;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    try {
      const { data } = await apiClient.get<FavoriteItem[]>('/favorites');
      setFavorites(data);
    } catch {
      setError('Favoriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  async function handleRemove(parcelId: string) {
    try {
      await apiClient.delete(`/favorites/${parcelId}`);
      setFavorites((prev) => prev.filter((f) => f.parcelId !== parcelId));
    } catch (err) {
      showApiError(err);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <Alert>{error}</Alert>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Favori İlanlarım</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {favorites.length > 0
              ? `${favorites.length} arsa takip ediyorsunuz`
              : 'Beğendiğiniz ve takip ettiğiniz arsalar'}
          </p>
        </div>
        <Link href="/parcels">
          <Button size="sm">Arsa Keşfet</Button>
        </Link>
      </div>

      {favorites.length === 0 ? (
        <div className="mt-12">
          <EmptyState message="Henüz favori ilanınız yok." />
          <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
            Arsaları keşfederek favorilerinize ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {favorites.map((fav) => {
            const parcel = fav.parcel;
            if (!parcel) {
              return (
                <Card key={fav.id} className="p-4 flex items-center justify-between">
                  <span className="text-sm text-[var(--muted-foreground)]">
                    İlan bulunamadı
                  </span>
                  <Button variant="danger" size="sm" onClick={() => handleRemove(fav.parcelId)}>
                    Kaldır
                  </Button>
                </Card>
              );
            }
            const status = parcelStatusConfig(parcel.status);
            const coverImg = parcel.images?.find((i) => i.isCover) || parcel.images?.[0];
            const imageUrl = coverImg ? resolveImageUrl(coverImg) : null;
            return (
              <Card key={fav.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                {/* Image */}
                <div className="relative h-40 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={parcel.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl text-gray-300">
                      🏞️
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); handleRemove(fav.parcelId); }}
                    className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-red-500 shadow hover:bg-white transition-colors"
                    title="Favorilerden kaldır"
                  >
                    ❤️
                  </button>
                </div>

                {/* Info */}
                <Link href={`/parcels/${parcel.id}`} className="block p-4">
                  <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-brand-500 transition-colors">
                    {parcel.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    📍 {parcel.city}, {parcel.district}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-brand-500">
                      {formatPrice(parcel.price)}
                    </span>
                    {parcel.areaM2 && (
                      <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-1 rounded">
                        {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
                      </span>
                    )}
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
