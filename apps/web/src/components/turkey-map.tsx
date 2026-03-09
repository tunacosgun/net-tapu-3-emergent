'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import type { Parcel, PaginatedResponse } from '@/types';

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

interface TurkeyMapProps {
  onProvinceClick?: (province: string) => void;
}

export function TurkeyMap({ onProvinceClick }: TurkeyMapProps) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAllParcels() {
      try {
        const all: Parcel[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const { data } = await apiClient.get<PaginatedResponse<Parcel>>('/parcels', {
            params: { status: 'active', limit: 100, page },
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

  const provinceData = useMemo(() => {
    const countByCity = new Map<string, number>();
    for (const parcel of parcels) {
      if (parcel.city) {
        countByCity.set(parcel.city, (countByCity.get(parcel.city) || 0) + 1);
      }
    }
    return PROVINCES.map((prov) => ({
      ...prov,
      parcelCount: countByCity.get(prov.name) || 0,
    }));
  }, [parcels]);

  const totalParcels = parcels.length;
  const activeCities = provinceData.filter((p) => p.parcelCount > 0).length;
  const hovered = provinceData.find((p) => p.name === hoveredProvince);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80 backdrop-blur-sm rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="text-sm font-medium text-gray-500">Harita yükleniyor...</p>
          </div>
        </div>
      )}

      {/* Map Stats Bar */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-brand-500 shadow-sm shadow-brand-500/30" />
            <span className="text-xs font-semibold text-gray-600">Arsa Mevcut</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400">Arsa Yok</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="font-bold text-brand-600">{totalParcels} arsa</span>
          <span className="text-gray-400">·</span>
          <span className="font-bold text-gray-600">{activeCities} il</span>
        </div>
      </div>

      {/* SVG Map */}
      <svg
        viewBox="180 175 620 240"
        className="w-full h-auto"
        role="img"
        aria-label="Türkiye Haritası"
      >
        {/* Background */}
        <rect x="180" y="175" width="620" height="240" fill="transparent" />

        {provinceData.map((prov) => {
          const hasData = prov.parcelCount > 0;
          const isHovered = hoveredProvince === prov.name;
          const baseRadius = hasData ? Math.min(7 + prov.parcelCount * 2.5, 16) : 4.5;
          const radius = isHovered ? baseRadius + 3 : baseRadius;

          return (
            <g
              key={prov.name}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredProvince(prov.name)}
              onMouseLeave={() => setHoveredProvince(null)}
              onClick={() => onProvinceClick?.(prov.name)}
            >
              {/* Pulse ring for provinces with data */}
              {hasData && isHovered && (
                <circle
                  cx={prov.x}
                  cy={prov.y}
                  r={radius + 6}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  opacity={0.3}
                >
                  <animate attributeName="r" from={String(radius)} to={String(radius + 12)} dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.4" to="0" dur="1s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Main circle */}
              <circle
                cx={prov.x}
                cy={prov.y}
                r={radius}
                fill={hasData ? (isHovered ? '#16a34a' : '#22c55e') : (isHovered ? '#d1d5db' : '#e5e7eb')}
                stroke={isHovered ? (hasData ? '#15803d' : '#9ca3af') : 'transparent'}
                strokeWidth={isHovered ? 2 : 0}
                className="transition-all duration-200"
              />

              {/* Count text on data markers */}
              {hasData && (
                <text
                  x={prov.x}
                  y={prov.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white font-bold pointer-events-none select-none"
                  fontSize={baseRadius > 10 ? 8 : 7}
                >
                  {prov.parcelCount}
                </text>
              )}

              {/* Province name label on hover */}
              {isHovered && (
                <g>
                  <rect
                    x={prov.x - 40}
                    y={prov.y - radius - 22}
                    width={80}
                    height={18}
                    rx={4}
                    fill={hasData ? '#15803d' : '#374151'}
                    opacity={0.95}
                  />
                  <text
                    x={prov.x}
                    y={prov.y - radius - 11}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white font-bold pointer-events-none select-none"
                    fontSize={8}
                  >
                    {prov.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating Info Card */}
      {hovered && (
        <div className="absolute bottom-4 right-4 rounded-xl bg-white border border-gray-200 shadow-xl p-4 min-w-[180px] animate-fadeInUp">
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-3 w-3 rounded-full ${hovered.parcelCount > 0 ? 'bg-brand-500' : 'bg-gray-300'}`} />
            <p className="text-sm font-bold text-gray-900">{hovered.name}</p>
          </div>
          {hovered.parcelCount > 0 ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-brand-600">{hovered.parcelCount}</span>
              <span className="text-xs font-medium text-gray-500">arsa mevcut</span>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Henüz arsa bulunmuyor</p>
          )}
          <p className="mt-2 text-[10px] text-gray-400">Tıklayarak arsaları görüntüleyin</p>
        </div>
      )}
    </div>
  );
}
