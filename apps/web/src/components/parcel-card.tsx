'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui';
import { parcelStatusConfig } from '@/components/ui/badge';
import { formatPrice, resolveImageUrl, timeAgo } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import apiClient from '@/lib/api-client';
import type { Parcel } from '@/types';

interface ParcelCardProps {
  parcel: Parcel;
  showFavorite?: boolean;
  favoriteId?: string | null;
  onFavoriteChange?: (parcelId: string, isFavorited: boolean) => void;
  variant?: 'default' | 'compact' | 'horizontal';
}

export function ParcelCard({
  parcel,
  showFavorite = true,
  favoriteId: initialFavoriteId = null,
  onFavoriteChange,
  variant = 'default',
}: ParcelCardProps) {
  const { isAuthenticated } = useAuthStore();
  const [favId, setFavId] = useState<string | null>(initialFavoriteId);
  const [toggling, setToggling] = useState(false);
  const isFavorited = !!favId;

  const status = parcelStatusConfig(parcel.status);

  const toggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isAuthenticated || toggling) return;

      setToggling(true);
      try {
        if (isFavorited && favId) {
          await apiClient.delete(`/favorites/${favId}`);
          setFavId(null);
          onFavoriteChange?.(parcel.id, false);
        } else {
          const { data } = await apiClient.post<{ id: string }>('/favorites', {
            parcelId: parcel.id,
          });
          setFavId(data.id);
          onFavoriteChange?.(parcel.id, true);
        }
      } catch {
        // silently fail
      } finally {
        setToggling(false);
      }
    },
    [isAuthenticated, toggling, isFavorited, favId, parcel.id, onFavoriteChange],
  );

  const firstImg = parcel.images?.[0];
  const imageUrl = firstImg ? resolveImageUrl(firstImg) : null;

  if (variant === 'horizontal') {
    return (
      <Link
        href={`/parcels/${parcel.id}`}
        className="group flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3 hover:border-brand-300 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
      >
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--muted)]">
          {imageUrl ? (
            <img src={imageUrl} alt={parcel.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg className="h-8 w-8 text-[var(--muted-foreground)] opacity-20" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
          )}
          <Badge variant={status.variant} className="absolute top-1.5 left-1.5 text-[10px]">
            {status.label}
          </Badge>
        </div>
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <h3 className="truncate font-bold group-hover:text-brand-500 transition-colors">
              {parcel.title}
            </h3>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              {parcel.city}, {parcel.district}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-brand-600">
              {formatPrice(parcel.price)}
            </span>
            {parcel.areaM2 && (
              <span className="text-xs font-medium text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-md">
                {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href={`/parcels/${parcel.id}`}
        className="group rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 hover:border-brand-300 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-bold group-hover:text-brand-500 transition-colors">
            {parcel.title}
          </h3>
          <Badge variant={status.variant} className="shrink-0 text-[10px]">
            {status.label}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {parcel.city}, {parcel.district}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-extrabold text-brand-600">
            {formatPrice(parcel.price)}
          </span>
          {parcel.areaM2 && (
            <span className="text-xs font-medium text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-md">
              {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
            </span>
          )}
        </div>
      </Link>
    );
  }

  // Default variant — card with image
  return (
    <Link
      href={`/parcels/${parcel.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-md shadow-gray-100/50 hover:shadow-2xl hover:shadow-gray-200/50 hover:-translate-y-1 hover:border-brand-200 transition-all duration-300"
    >
      {/* Image area */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--muted)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={parcel.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Status badge */}
        <Badge variant={status.variant} className="absolute top-3 left-3 shadow-md">
          {status.label}
        </Badge>

        {/* Auction eligible tag */}
        {parcel.isAuctionEligible && (
          <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg shadow-brand-500/30">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            </svg>
            Açık Artırma
          </span>
        )}

        {/* Favorite button */}
        {showFavorite && isAuthenticated && (
          <button
            onClick={toggleFavorite}
            disabled={toggling}
            className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl shadow-lg transition-all duration-200 ${
              isFavorited
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30'
                : 'bg-white/95 text-gray-400 hover:bg-white hover:text-red-500 shadow-black/10'
            }`}
            aria-label={isFavorited ? 'Favorilerden kaldır' : 'Favorilere ekle'}
          >
            <svg
              className="h-4.5 w-4.5"
              fill={isFavorited ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-bold text-[15px] leading-snug group-hover:text-brand-600 transition-colors line-clamp-2">
          {parcel.title}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
          <svg className="h-4 w-4 shrink-0 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {parcel.city}, {parcel.district}
        </p>

        {/* Details row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {parcel.areaM2 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
            </span>
          )}
          {parcel.zoningStatus && (
            <span className="inline-flex items-center rounded-lg bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] truncate max-w-[140px]">
              {parcel.zoningStatus}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mt-4 flex items-end justify-between border-t border-[var(--border)] pt-4">
          <div>
            <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Fiyat</p>
            <span className="text-xl font-extrabold text-brand-600 tracking-tight">
              {formatPrice(parcel.price)}
            </span>
          </div>
          {parcel.areaM2 && parcel.price && (
            <span className="text-xs font-semibold text-[var(--muted-foreground)] bg-brand-50 px-2 py-1 rounded-md">
              {formatPrice(String(Math.round(parseFloat(parcel.price) / parseFloat(parcel.areaM2))))}
              /m²
            </span>
          )}
        </div>

        {/* Date + Ada/Parsel */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
          {parcel.createdAt && (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {timeAgo(parcel.createdAt)}
            </span>
          )}
          {parcel.ada && parcel.parsel && (
            <span className="font-medium">Ada {parcel.ada} / Parsel {parcel.parsel}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
