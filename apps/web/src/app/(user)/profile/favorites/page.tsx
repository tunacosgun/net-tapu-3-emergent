'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
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

  async function handleRemove(favoriteId: string) {
    try {
      await apiClient.delete(`/favorites/${favoriteId}`);
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
    } catch (err) {
      showApiError(err);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <Alert>{error}</Alert>;

  return (
    <div>
      <h2 className="text-lg font-semibold">Favori İlanlarım</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Beğendiğiniz ve takip ettiğiniz arsalar
      </p>

      {favorites.length === 0 ? (
        <EmptyState message="Henüz favori ilanınız yok." />
      ) : (
        <div className="mt-6 space-y-3">
          {favorites.map((fav) => {
            const parcel = fav.parcel;
            if (!parcel) {
              return (
                <Card key={fav.id} className="p-4 flex items-center justify-between">
                  <span className="text-sm text-[var(--muted-foreground)]">
                    İlan bulunamadı (ID: {fav.parcelId})
                  </span>
                  <Button variant="danger" size="sm" onClick={() => handleRemove(fav.id)}>
                    Kaldır
                  </Button>
                </Card>
              );
            }
            const status = parcelStatusConfig(parcel.status);
            return (
              <Card key={fav.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/parcels/${parcel.id}`}
                    className="flex-1 hover:text-brand-500 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{parcel.title}</h3>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      📍 {parcel.city}, {parcel.district}
                    </p>
                    <p className="mt-1 text-sm font-bold text-brand-500">
                      {formatPrice(parcel.price)}
                      {parcel.areaM2 && (
                        <span className="ml-2 font-normal text-[var(--muted-foreground)]">
                          {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
                        </span>
                      )}
                    </p>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(fav.id)}>
                    ✕
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
