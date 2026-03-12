'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { TURKEY_PROVINCES } from '@/data/turkey-paths';
import type { Parcel, PaginatedResponse } from '@/types';

interface TurkeyMapProps {
  onProvinceClick?: (province: string) => void;
}

export function TurkeyMap({ onProvinceClick }: TurkeyMapProps) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAllParcels() {
      try {
        const all: Parcel[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const { data } = await apiClient.get<PaginatedResponse<Parcel>>('/parcels', {
            params: { limit: 100, page },
          });
          all.push(...data.data);
          totalPages = data.meta.totalPages;
          page++;
        } while (page <= totalPages && !cancelled);
        if (!cancelled) setParcels(all);
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAllParcels();
    return () => { cancelled = true; };
  }, []);

  const countByCity = useMemo(() => {
    const map = new Map<string, number>();
    for (const parcel of parcels) {
      if (parcel.city) {
        map.set(parcel.city, (map.get(parcel.city) || 0) + 1);
      }
    }
    return map;
  }, [parcels]);

  // Status breakdown per city
  const statusByCity = useMemo(() => {
    const map = new Map<string, { active: number; sold: number; deposit: number; other: number }>();
    for (const parcel of parcels) {
      if (!parcel.city) continue;
      const entry = map.get(parcel.city) || { active: 0, sold: 0, deposit: 0, other: 0 };
      if (parcel.status === 'active') entry.active++;
      else if (parcel.status === 'sold') entry.sold++;
      else if (parcel.status === 'deposit_taken') entry.deposit++;
      else entry.other++;
      map.set(parcel.city, entry);
    }
    return map;
  }, [parcels]);

  // Determine dominant status for province coloring
  const getDominantStatus = useCallback((name: string) => {
    const entry = statusByCity.get(name);
    if (!entry) return 'none';
    if (entry.active > 0) return 'active';
    if (entry.deposit > 0) return 'deposit';
    if (entry.sold > 0) return 'sold';
    return 'other';
  }, [statusByCity]);

  const totalParcels = parcels.length;
  const activeCities = countByCity.size;
  const maxCount = Math.max(1, ...countByCity.values());

  const getProvinceName = useCallback((id: string) => {
    const prov = TURKEY_PROVINCES.find(p => p.id === id);
    return prov?.name || id;
  }, []);

  const getParcelCount = useCallback((name: string) => {
    return countByCity.get(name) || 0;
  }, [countByCity]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const hoveredData = hoveredProvince ? {
    name: getProvinceName(hoveredProvince),
    count: getParcelCount(getProvinceName(hoveredProvince)),
    status: statusByCity.get(getProvinceName(hoveredProvince)),
  } : null;

  return (
    <div className="relative" onMouseMove={handleMouseMove}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80 backdrop-blur-sm rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="text-sm font-medium text-gray-500">Harita yükleniyor...</p>
          </div>
        </div>
      )}

      {/* Legend & Stats */}
      <div className="flex flex-wrap items-center justify-between mb-4 px-1 gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-green-500" />
            <span className="text-[11px] font-semibold text-gray-500">Satışta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-blue-500" />
            <span className="text-[11px] font-semibold text-gray-500">Kaparo Alındı</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-red-400" />
            <span className="text-[11px] font-semibold text-gray-500">Satıldı</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-gray-100 border border-gray-200" />
            <span className="text-[11px] font-semibold text-gray-400">Arsa Yok</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-bold text-brand-600">{totalParcels} arsa</span>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-500">{activeCities} il</span>
        </div>
      </div>

      {/* SVG Map */}
      <svg
        viewBox="0 0 1005 490"
        className="w-full h-auto"
        role="img"
        aria-label="Türkiye Haritası"
      >
        <defs>
          <filter id="province-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.1" />
          </filter>
          <linearGradient id="active-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="hover-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
        </defs>

        {TURKEY_PROVINCES.map((prov) => {
          const count = getParcelCount(prov.name);
          const hasData = count > 0;
          const isHovered = hoveredProvince === prov.id;
          // Intensity based on parcel count
          const intensity = hasData ? Math.min(0.4 + (count / maxCount) * 0.6, 1) : 0;

          const dominant = getDominantStatus(prov.name);
          const statusColors: Record<string, { base: string; hover: string; light: string }> = {
            active: { base: '#22c55e', hover: '#15803d', light: '#86efac' },
            deposit: { base: '#3b82f6', hover: '#1d4ed8', light: '#93c5fd' },
            sold: { base: '#f87171', hover: '#dc2626', light: '#fca5a5' },
            other: { base: '#a78bfa', hover: '#7c3aed', light: '#c4b5fd' },
            none: { base: '#f3f4f6', hover: '#d1d5db', light: '#f3f4f6' },
          };
          const sc = statusColors[dominant] || statusColors.none;

          let fill: string;
          if (isHovered && hasData) {
            fill = sc.hover;
          } else if (isHovered) {
            fill = '#d1d5db';
          } else if (hasData) {
            // Intensity based on count
            const t = intensity;
            // Interpolate between light and base color
            fill = t > 0.7 ? sc.base : sc.light;
          } else {
            fill = '#f3f4f6';
          }

          return (
            <path
              key={prov.id + prov.d.substring(0, 20)}
              d={prov.d}
              fill={fill}
              stroke={isHovered ? (hasData ? sc.hover : '#9ca3af') : '#fff'}
              strokeWidth={isHovered ? 2 : 0.8}
              className="cursor-pointer transition-colors duration-150"
              onMouseEnter={() => setHoveredProvince(prov.id)}
              onMouseLeave={() => setHoveredProvince(null)}
              onClick={() => onProvinceClick?.(prov.name)}
              style={isHovered ? { filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' } : undefined}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredData && tooltipPos && (
        <div
          className="pointer-events-none absolute z-20 animate-fadeInUp"
          style={{
            left: tooltipPos.x + 16,
            top: tooltipPos.y - 60,
          }}
        >
          <div className="rounded-xl bg-white border border-gray-200 shadow-2xl px-4 py-3 min-w-[160px]">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${hoveredData.count > 0 ? 'bg-brand-500' : 'bg-gray-300'}`} />
              <p className="text-sm font-bold text-gray-900">{hoveredData.name}</p>
            </div>
            {hoveredData.count > 0 ? (
              <div>
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className="text-xl font-extrabold text-brand-600">{hoveredData.count}</span>
                  <span className="text-[11px] font-medium text-gray-400">arsa</span>
                </div>
                {hoveredData.status && (
                  <div className="space-y-0.5 text-[10px]">
                    {hoveredData.status.active > 0 && (
                      <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /><span className="text-gray-500">{hoveredData.status.active} satışta</span></div>
                    )}
                    {hoveredData.status.deposit > 0 && (
                      <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /><span className="text-gray-500">{hoveredData.status.deposit} kaparo</span></div>
                    )}
                    {hoveredData.status.sold > 0 && (
                      <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /><span className="text-gray-500">{hoveredData.status.sold} satıldı</span></div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">Henüz arsa bulunmuyor</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
