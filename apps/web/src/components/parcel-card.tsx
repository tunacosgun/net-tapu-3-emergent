'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui';
import { parcelStatusConfig } from '@/components/ui/badge';
import { formatPrice, resolveImageUrl, timeAgo } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import apiClient from '@/lib/api-client';
import { MapPin, Maximize2, Heart, Flame, Clock, ImageIcon } from 'lucide-react';
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
        className="group flex gap-4 rounded-2xl border border-gray-200/80 bg-white p-3 hover:border-brand-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
      >
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {imageUrl ? (
            <img src={imageUrl} alt={parcel.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-gray-300" />
            </div>
          )}
          <Badge variant={status.variant} className="absolute top-1.5 left-1.5 text-[10px]">
            {status.label}
          </Badge>
        </div>
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <h3 className="truncate font-semibold text-gray-900 group-hover:text-brand-600 transition-colors duration-150">
              {parcel.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              {parcel.city}, {parcel.district}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-brand-600 tracking-tight">
              {formatPrice(parcel.price)}
            </span>
            {parcel.areaM2 && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
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
        className="group rounded-xl border border-gray-200/80 bg-white p-4 hover:border-brand-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors duration-150">
            {parcel.title}
          </h3>
          <Badge variant={status.variant} className="shrink-0 text-[10px]">
            {status.label}
          </Badge>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="h-3 w-3" />
          {parcel.city}, {parcel.district}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-bold text-brand-600 tracking-tight">
            {formatPrice(parcel.price)}
          </span>
          {parcel.areaM2 && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
              {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
            </span>
          )}
        </div>
      </Link>
    );
  }

  // Default — full card with image
  return (
    <Link
      href={`/parcels/${parcel.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-sm hover:shadow-xl hover:shadow-gray-200/60 hover:-translate-y-1 hover:border-brand-200 transition-all duration-300 cursor-pointer"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={parcel.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <ImageIcon className="h-10 w-10 text-gray-300" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status */}
        <Badge variant={status.variant} className="absolute top-3 left-3 shadow-sm">
          {status.label}
        </Badge>

        {/* Auction tag */}
        {parcel.isAuctionEligible && (
          <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg shadow-brand-500/25">
            <Flame className="h-3 w-3" />
            Açık Artırma
          </span>
        )}

        {/* Favorite */}
        {showFavorite && isAuthenticated && (
          <button
            onClick={toggleFavorite}
            disabled={toggling}
            className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl shadow-lg transition-all duration-200 cursor-pointer active:scale-90 ${
              isFavorited
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/30'
                : 'bg-white/90 backdrop-blur-sm text-gray-400 hover:bg-white hover:text-rose-500 shadow-black/8'
            }`}
            aria-label={isFavorited ? 'Favorilerden kaldır' : 'Favorilere ekle'}
          >
            <Heart className="h-4 w-4" fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-semibold text-[15px] leading-snug text-gray-900 group-hover:text-brand-600 transition-colors duration-150 line-clamp-2">
          {parcel.title}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="h-3.5 w-3.5 text-brand-400 shrink-0" />
          {parcel.city}, {parcel.district}
        </p>

        {/* Detail pills */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {parcel.areaM2 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
              <Maximize2 className="h-3 w-3 text-gray-400" />
              {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
            </span>
          )}
          {parcel.zoningStatus && (
            <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 truncate max-w-[140px]">
              {parcel.zoningStatus}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between border-t border-gray-100 pt-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fiyat</p>
              <span className="text-xl font-bold text-brand-600 tracking-tight">
                {formatPrice(parcel.price)}
              </span>
            </div>
            {(parcel.pricePerM2 || (parcel.areaM2 && parcel.price)) && (
              <span className="text-xs font-semibold text-brand-600/70 bg-brand-50 px-2.5 py-1 rounded-lg">
                {formatPrice(parcel.pricePerM2 ?? String(Math.round(parseFloat(parcel.price!) / parseFloat(parcel.areaM2!))))}
                /m²
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-gray-400">
          {parcel.createdAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
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
