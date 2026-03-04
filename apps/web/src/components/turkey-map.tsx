'use client';

import { useEffect, useState, useMemo } from 'react';
import apiClient from '@/lib/api-client';
import type { Auction, PaginatedResponse } from '@/types';

// Turkey's 81 provinces with approximate center coordinates
const PROVINCES: { name: string; x: number; y: number }[] = [
  { name: 'Adana', x: 555, y: 365 },
  { name: 'Adıyaman', x: 615, y: 325 },
  { name: 'Afyonkarahisar', x: 400, y: 300 },
  { name: 'Ağrı', x: 730, y: 255 },
  { name: 'Aksaray', x: 480, y: 310 },
  { name: 'Amasya', x: 545, y: 240 },
  { name: 'Ankara', x: 440, y: 270 },
  { name: 'Antalya', x: 400, y: 380 },
  { name: 'Ardahan', x: 720, y: 210 },
  { name: 'Artvin', x: 680, y: 210 },
  { name: 'Aydın', x: 310, y: 345 },
  { name: 'Balıkesir', x: 290, y: 240 },
  { name: 'Bartın', x: 440, y: 210 },
  { name: 'Batman', x: 670, y: 310 },
  { name: 'Bayburt', x: 645, y: 235 },
  { name: 'Bilecik', x: 365, y: 250 },
  { name: 'Bingöl', x: 680, y: 280 },
  { name: 'Bitlis', x: 710, y: 290 },
  { name: 'Bolu', x: 410, y: 235 },
  { name: 'Burdur', x: 385, y: 350 },
  { name: 'Bursa', x: 330, y: 245 },
  { name: 'Çanakkale', x: 255, y: 240 },
  { name: 'Çankırı', x: 470, y: 240 },
  { name: 'Çorum', x: 500, y: 240 },
  { name: 'Denizli', x: 345, y: 340 },
  { name: 'Diyarbakır', x: 650, y: 310 },
  { name: 'Düzce', x: 400, y: 225 },
  { name: 'Edirne', x: 215, y: 200 },
  { name: 'Elazığ', x: 640, y: 290 },
  { name: 'Erzincan', x: 640, y: 260 },
  { name: 'Erzurum', x: 680, y: 250 },
  { name: 'Eskişehir', x: 385, y: 270 },
  { name: 'Gaziantep', x: 590, y: 355 },
  { name: 'Giresun', x: 610, y: 225 },
  { name: 'Gümüşhane', x: 635, y: 235 },
  { name: 'Hakkari', x: 745, y: 320 },
  { name: 'Hatay', x: 570, y: 385 },
  { name: 'Iğdır', x: 740, y: 240 },
  { name: 'Isparta', x: 395, y: 335 },
  { name: 'İstanbul', x: 300, y: 215 },
  { name: 'İzmir', x: 275, y: 305 },
  { name: 'Kahramanmaraş', x: 580, y: 340 },
  { name: 'Karabük', x: 445, y: 220 },
  { name: 'Karaman', x: 465, y: 340 },
  { name: 'Kars', x: 730, y: 230 },
  { name: 'Kastamonu', x: 475, y: 218 },
  { name: 'Kayseri', x: 530, y: 300 },
  { name: 'Kilis', x: 590, y: 370 },
  { name: 'Kırıkkale', x: 470, y: 260 },
  { name: 'Kırklareli', x: 240, y: 195 },
  { name: 'Kırşehir', x: 490, y: 275 },
  { name: 'Kocaeli', x: 340, y: 228 },
  { name: 'Konya', x: 450, y: 330 },
  { name: 'Kütahya', x: 365, y: 275 },
  { name: 'Malatya', x: 610, y: 300 },
  { name: 'Manisa', x: 300, y: 295 },
  { name: 'Mardin', x: 665, y: 330 },
  { name: 'Mersin', x: 510, y: 370 },
  { name: 'Muğla', x: 325, y: 365 },
  { name: 'Muş', x: 700, y: 275 },
  { name: 'Nevşehir', x: 500, y: 300 },
  { name: 'Niğde', x: 500, y: 325 },
  { name: 'Ordu', x: 585, y: 225 },
  { name: 'Osmaniye', x: 565, y: 360 },
  { name: 'Rize', x: 660, y: 218 },
  { name: 'Sakarya', x: 365, y: 232 },
  { name: 'Samsun', x: 560, y: 222 },
  { name: 'Şanlıurfa', x: 625, y: 345 },
  { name: 'Siirt', x: 695, y: 305 },
  { name: 'Sinop', x: 520, y: 210 },
  { name: 'Sivas', x: 575, y: 270 },
  { name: 'Şırnak', x: 715, y: 325 },
  { name: 'Tekirdağ', x: 255, y: 210 },
  { name: 'Tokat', x: 555, y: 248 },
  { name: 'Trabzon', x: 640, y: 222 },
  { name: 'Tunceli', x: 655, y: 275 },
  { name: 'Uşak', x: 345, y: 300 },
  { name: 'Van', x: 730, y: 290 },
  { name: 'Yalova', x: 330, y: 235 },
  { name: 'Yozgat', x: 510, y: 265 },
  { name: 'Zonguldak', x: 425, y: 215 },
];

interface ProvinceData {
  name: string;
  x: number;
  y: number;
  liveCount: number;
  scheduledCount: number;
  endedCount: number;
  totalCount: number;
}

function getColor(data: ProvinceData): string {
  if (data.liveCount > 0) return '#22c55e'; // live green
  if (data.scheduledCount > 0) return '#3b82f6'; // scheduled blue
  if (data.endedCount > 0) return '#6b7280'; // ended gray
  return 'transparent';
}

interface TurkeyMapProps {
  onProvinceClick?: (province: string) => void;
}

export function TurkeyMap({ onProvinceClick }: TurkeyMapProps) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAuctions() {
      try {
        const { data } = await apiClient.get<PaginatedResponse<Auction>>('/auctions', {
          params: { limit: 100 },
        });
        if (!cancelled) setAuctions(data.data);
      } catch {
        // Silently fail — map still renders empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAuctions();
    return () => { cancelled = true; };
  }, []);

  // We need a mapping from auction.parcelId to city, which requires parcels.
  // For now, we use auction.title which typically contains the city name.
  // This is a best-effort aggregation.
  const provinceData = useMemo(() => {
    const map = new Map<string, { live: number; scheduled: number; ended: number }>();

    for (const auction of auctions) {
      // Try to match province from auction title
      for (const prov of PROVINCES) {
        if (auction.title.includes(prov.name)) {
          const existing = map.get(prov.name) || { live: 0, scheduled: 0, ended: 0 };
          if (auction.status === 'live' || auction.status === 'ending') existing.live++;
          else if (auction.status === 'scheduled' || auction.status === 'deposit_open') existing.scheduled++;
          else if (auction.status === 'ended' || auction.status === 'settled') existing.ended++;
          map.set(prov.name, existing);
          break;
        }
      }
    }

    return PROVINCES.map((prov): ProvinceData => {
      const counts = map.get(prov.name) || { live: 0, scheduled: 0, ended: 0 };
      return {
        ...prov,
        liveCount: counts.live,
        scheduledCount: counts.scheduled,
        endedCount: counts.ended,
        totalCount: counts.live + counts.scheduled + counts.ended,
      };
    });
  }, [auctions]);

  const hovered = provinceData.find((p) => p.name === hoveredProvince);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/80 z-10">
          <p className="text-sm text-[var(--muted-foreground)]">Harita yükleniyor...</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#22c55e]" /> Canlı
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#3b82f6]" /> Planlanan
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#6b7280]" /> Sona Eren
        </span>
      </div>

      <svg
        viewBox="180 180 620 230"
        className="w-full h-auto"
        role="img"
        aria-label="Türkiye Haritası"
      >
        {/* Background */}
        <rect x="180" y="180" width="620" height="230" fill="transparent" />

        {provinceData.map((prov) => {
          const color = getColor(prov);
          const hasData = prov.totalCount > 0;
          const isHovered = hoveredProvince === prov.name;
          const radius = hasData ? Math.min(6 + prov.totalCount * 2, 14) : 4;

          return (
            <g
              key={prov.name}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredProvince(prov.name)}
              onMouseLeave={() => setHoveredProvince(null)}
              onClick={() => onProvinceClick?.(prov.name)}
            >
              <circle
                cx={prov.x}
                cy={prov.y}
                r={isHovered ? radius + 2 : radius}
                fill={hasData ? color : 'var(--muted)'}
                stroke={isHovered ? 'var(--foreground)' : hasData ? color : 'var(--border)'}
                strokeWidth={isHovered ? 2 : 1}
                opacity={hasData ? 0.85 : 0.4}
                className="transition-all duration-150"
              />
              {hasData && (
                <text
                  x={prov.x}
                  y={prov.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white text-[7px] font-bold pointer-events-none"
                >
                  {prov.totalCount}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute top-2 right-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 shadow-lg text-sm">
          <p className="font-semibold">{hovered.name}</p>
          {hovered.totalCount > 0 ? (
            <div className="mt-1 space-y-0.5 text-xs text-[var(--muted-foreground)]">
              {hovered.liveCount > 0 && <p>Canlı: {hovered.liveCount}</p>}
              {hovered.scheduledCount > 0 && <p>Planlanan: {hovered.scheduledCount}</p>}
              {hovered.endedCount > 0 && <p>Sona Eren: {hovered.endedCount}</p>}
            </div>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Açık artırma yok</p>
          )}
        </div>
      )}
    </div>
  );
}
