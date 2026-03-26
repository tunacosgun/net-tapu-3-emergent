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
        className="group flex gap-4 rounded-xl bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300"
        data-testid={`parcel-card-horizontal-${parcel.id}`}
      >
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          {imageUrl ? (
            <img src={imageUrl} alt={parcel.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-slate-300" />
            </div>
          )}
          <Badge variant={status.variant} className="absolute top-1.5 left-1.5 text-[10px]">
            {status.label}
          </Badge>
        </div>
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <h3 className="truncate font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors duration-150">
              {parcel.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {parcel.city}, {parcel.district}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-emerald-600 tracking-tight">
              {formatPrice(parcel.price)}
            </span>
            {parcel.areaM2 && (
              <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
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
        className="group rounded-xl bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300"
        data-testid={`parcel-card-compact-${parcel.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors duration-150">
            {parcel.title}
          </h3>
          <Badge variant={status.variant} className="shrink-0 text-[10px]">
            {status.label}
          </Badge>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3 w-3" />
          {parcel.city}, {parcel.district}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-bold text-emerald-600 tracking-tight">
            {formatPrice(parcel.price)}
          </span>
          {parcel.areaM2 && (
            <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
              {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
            </span>
          )}
        </div>
      </Link>
    );
  }

  // Default — full card with image (Professional design)
  return (
    <Link
      href={`/parcels/${parcel.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300"
      data-testid={`parcel-card-${parcel.id}`}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={parcel.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <ImageIcon className="h-10 w-10 text-slate-300" />
          </div>
        )}

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status */}
        <Badge variant={status.variant} className="absolute top-3 left-3 shadow-sm">
          {status.label}
        </Badge>

        {/* Auction tag */}
        {parcel.isAuctionEligible && (
          <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
            <Flame className="h-3 w-3" />
            Açık Artırma
          </span>
        )}

        {/* Favorite */}
        {showFavorite && isAuthenticated && (
          <button
            onClick={toggleFavorite}
            disabled={toggling}
            className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg shadow-lg transition-all duration-200 active:scale-90 ${
              isFavorited
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : 'bg-white/90 backdrop-blur-sm text-slate-400 hover:bg-white hover:text-rose-500'
            }`}
            aria-label={isFavorited ? 'Favorilerden kaldır' : 'Favorilere ekle'}
            data-testid={`favorite-btn-${parcel.id}`}
          >
            <Heart className="h-4 w-4" fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-semibold text-[15px] leading-snug text-slate-900 group-hover:text-emerald-600 transition-colors duration-150 line-clamp-2">
          {parcel.title}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          {parcel.city}, {parcel.district}
        </p>

        {/* Detail pills */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {parcel.areaM2 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              <Maximize2 className="h-3 w-3 text-slate-400" />
              {Number(parcel.areaM2).toLocaleString('tr-TR')} m²
            </span>
          )}
          {parcel.zoningStatus && (
            <span className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 truncate max-w-[140px]">
              {parcel.zoningStatus}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between pt-4 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Fiyat</p>
              <span className="text-xl font-bold text-emerald-600 tracking-tight">
                {formatPrice(parcel.price)}
              </span>
            </div>
            {(parcel.pricePerM2 || (parcel.areaM2 && parcel.price)) && (
              <span className="text-xs font-semibold text-emerald-600/70 bg-emerald-50 px-2.5 py-1 rounded-lg">
                {formatPrice(parcel.pricePerM2 ?? String(Math.round(parseFloat(parcel.price!) / parseFloat(parcel.areaM2!))))}
                /m²
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
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
