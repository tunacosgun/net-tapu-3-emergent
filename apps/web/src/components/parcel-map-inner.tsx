'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Parcel } from '@/types';

interface ParcelMapInnerProps {
  parcels: Parcel[];
  onParcelClick?: (parcel: Parcel) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  showSatellite?: boolean;
}

// Turkey center coordinates
const TURKEY_CENTER: [number, number] = [39.0, 35.0];
const DEFAULT_ZOOM = 6;

const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_TILE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * Approximate city center coordinates for all 81 Turkish provinces.
 * Used as fallback when a parcel has no lat/lng.
 */
const CITY_COORDINATES: Record<string, [number, number]> = {
  'Adana': [37.0, 35.3213],
  'Adıyaman': [37.7648, 38.2786],
  'Afyonkarahisar': [38.7507, 30.5567],
  'Ağrı': [39.7191, 43.0503],
  'Aksaray': [38.3687, 34.0370],
  'Amasya': [40.6499, 35.8353],
  'Ankara': [39.9334, 32.8597],
  'Antalya': [36.8969, 30.7133],
  'Ardahan': [41.1105, 42.7022],
  'Artvin': [41.1828, 41.8183],
  'Aydın': [37.8560, 27.8416],
  'Balıkesir': [39.6484, 27.8826],
  'Bartın': [41.6344, 32.3375],
  'Batman': [37.8812, 41.1351],
  'Bayburt': [40.2552, 40.2249],
  'Bilecik': [40.0567, 30.0665],
  'Bingöl': [38.8854, 40.4966],
  'Bitlis': [38.4010, 42.1095],
  'Bolu': [40.7360, 31.6113],
  'Burdur': [37.7203, 30.2905],
  'Bursa': [40.1826, 29.0665],
  'Çanakkale': [40.1553, 26.4142],
  'Çankırı': [40.6013, 33.6134],
  'Çorum': [40.5506, 34.9556],
  'Denizli': [37.7765, 29.0864],
  'Diyarbakır': [37.9144, 40.2306],
  'Düzce': [40.8438, 31.1565],
  'Edirne': [41.6818, 26.5623],
  'Elazığ': [38.6810, 39.2264],
  'Erzincan': [39.7500, 39.5000],
  'Erzurum': [39.9000, 41.2700],
  'Eskişehir': [39.7767, 30.5206],
  'Gaziantep': [37.0662, 37.3833],
  'Giresun': [40.9128, 38.3895],
  'Gümüşhane': [40.4386, 39.5086],
  'Hakkari': [37.5833, 43.7408],
  'Hatay': [36.4018, 36.3498],
  'Iğdır': [39.9167, 44.0500],
  'Isparta': [37.7648, 30.5566],
  'İstanbul': [41.0082, 28.9784],
  'İzmir': [38.4192, 27.1287],
  'Kahramanmaraş': [37.5858, 36.9371],
  'Karabük': [41.2061, 32.6204],
  'Karaman': [37.1759, 33.2287],
  'Kars': [40.6167, 43.1000],
  'Kastamonu': [41.3887, 33.7827],
  'Kayseri': [38.7312, 35.4787],
  'Kırıkkale': [39.8468, 33.5153],
  'Kırklareli': [41.7333, 27.2167],
  'Kırşehir': [39.1425, 34.1709],
  'Kilis': [36.7184, 37.1212],
  'Kocaeli': [40.8533, 29.8815],
  'Konya': [37.8746, 32.4932],
  'Kütahya': [39.4167, 29.9833],
  'Malatya': [38.3552, 38.3095],
  'Manisa': [38.6191, 27.4289],
  'Mardin': [37.3212, 40.7245],
  'Mersin': [36.8121, 34.6415],
  'Muğla': [37.2153, 28.3636],
  'Muş': [38.9462, 41.7539],
  'Nevşehir': [38.6939, 34.6857],
  'Niğde': [37.9667, 34.6833],
  'Ordu': [40.9839, 37.8764],
  'Osmaniye': [37.0742, 36.2464],
  'Rize': [41.0201, 40.5234],
  'Sakarya': [40.6940, 30.4358],
  'Samsun': [41.2928, 36.3313],
  'Şanlıurfa': [37.1591, 38.7969],
  'Siirt': [37.9333, 41.9500],
  'Sinop': [42.0231, 35.1531],
  'Sivas': [39.7477, 37.0179],
  'Şırnak': [37.4187, 42.4918],
  'Tekirdağ': [40.9833, 27.5167],
  'Tokat': [40.3167, 36.5544],
  'Trabzon': [41.0027, 39.7168],
  'Tunceli': [39.1079, 39.5401],
  'Uşak': [38.6823, 29.4082],
  'Van': [38.4891, 43.4089],
  'Yalova': [40.6500, 29.2667],
  'Yozgat': [39.8181, 34.8147],
  'Zonguldak': [41.4564, 31.7987],
};

/** Try to resolve coordinates for a parcel: use lat/lng if available, else fall back to city center */
function resolveParcelCoords(parcel: Parcel): { lat: number; lng: number; approximate: boolean } | null {
  // Exact coordinates
  if (
    parcel.latitude &&
    parcel.longitude &&
    !isNaN(parseFloat(parcel.latitude)) &&
    !isNaN(parseFloat(parcel.longitude))
  ) {
    return { lat: parseFloat(parcel.latitude), lng: parseFloat(parcel.longitude), approximate: false };
  }

  // Fallback: city center (instant, refined later via Nominatim)
  if (parcel.city) {
    const normalized = parcel.city.trim();
    const coords = CITY_COORDINATES[normalized];
    if (coords) {
      const jitter = () => (Math.random() - 0.5) * 0.01;
      return { lat: coords[0] + jitter(), lng: coords[1] + jitter(), approximate: true };
    }

    // Try case-insensitive match
    const lowerCity = normalized.toLocaleLowerCase('tr');
    for (const [key, value] of Object.entries(CITY_COORDINATES)) {
      if (key.toLocaleLowerCase('tr') === lowerCity) {
        const jitter = () => (Math.random() - 0.5) * 0.01;
        return { lat: value[0] + jitter(), lng: value[1] + jitter(), approximate: true };
      }
    }
  }

  return null;
}

// ── Nominatim geocoding cache (shared across renders) ────────────────
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

/** Build a geocoding cache key from parcel address components */
function geocodeCacheKey(parcel: Parcel): string {
  return [parcel.address, parcel.neighborhood, parcel.district, parcel.city].filter(Boolean).join('|');
}

/** Geocode a single parcel's address via Nominatim (OpenStreetMap) */
async function geocodeParcel(parcel: Parcel): Promise<{ lat: number; lng: number } | null> {
  const key = geocodeCacheKey(parcel);
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  // Build query: address (cadde/sokak) + neighborhood + district + city
  const parts: string[] = [];
  if (parcel.address) parts.push(parcel.address);
  if (parcel.neighborhood) parts.push(parcel.neighborhood);
  if (parcel.district) parts.push(parcel.district);
  if (parcel.city) parts.push(parcel.city);
  parts.push('Türkiye');

  const query = parts.join(', ');
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=tr&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NetTapu-Platform/1.0', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Nominatim error');
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(key, result);
      return result;
    }

    // Fallback: try without address (just neighborhood + district + city)
    if (parcel.address) {
      const noAddr = [parcel.neighborhood, parcel.district, parcel.city, 'Türkiye'].filter(Boolean).join(', ');
      const res1b = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(noAddr)}&format=json&countrycodes=tr&limit=1`,
        { headers: { 'User-Agent': 'NetTapu-Platform/1.0', Accept: 'application/json' } },
      );
      const data1b = await res1b.json() as Array<{ lat: string; lon: string }>;
      if (data1b.length > 0) {
        const result = { lat: parseFloat(data1b[0].lat), lng: parseFloat(data1b[0].lon) };
        geocodeCache.set(key, result);
        return result;
      }
    }

    // Fallback: try just district + city
    if (parcel.neighborhood && parcel.district) {
      const fallback = `${parcel.district}, ${parcel.city}, Türkiye`;
      const res2 = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallback)}&format=json&countrycodes=tr&limit=1`,
        { headers: { 'User-Agent': 'NetTapu-Platform/1.0', Accept: 'application/json' } },
      );
      const data2 = await res2.json() as Array<{ lat: string; lon: string }>;
      if (data2.length > 0) {
        const result = { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
        geocodeCache.set(key, result);
        return result;
      }
    }
  } catch {
    // Geocoding failed — fall through
  }

  geocodeCache.set(key, null);
  return null;
}

/**
 * Map component using plain Leaflet (no react-leaflet).
 * This avoids ESM-only react-leaflet v5 compatibility issues with Next.js 14.
 */
export default function ParcelMapInner({
  parcels,
  onParcelClick,
  center,
  zoom,
  height = '500px',
  showSatellite = false,
}: ParcelMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);
  const [satelliteMode, setSatelliteMode] = useState(showSatellite);
  const [ready, setReady] = useState(false);

  // Resolve coordinates for all parcels (exact + city-center fallback)
  const mappableParcels = useMemo(() => {
    return parcels
      .map((p) => {
        const coords = resolveParcelCoords(p);
        if (!coords) return null;
        return { parcel: p, ...coords };
      })
      .filter(Boolean) as Array<{ parcel: Parcel; lat: number; lng: number; approximate: boolean }>;
  }, [parcels]);

  // Calculate map center based on parcels or use default
  const mapCenter = useMemo(() => {
    if (center) return center;
    if (mappableParcels.length === 0) return TURKEY_CENTER;

    const avgLat =
      mappableParcels.reduce((sum, p) => sum + p.lat, 0) / mappableParcels.length;
    const avgLng =
      mappableParcels.reduce((sum, p) => sum + p.lng, 0) / mappableParcels.length;

    return [avgLat, avgLng] as [number, number];
  }, [center, mappableParcels]);

  const mapZoom = zoom ?? (mappableParcels.length === 1 ? 14 : DEFAULT_ZOOM);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let cancelled = false;

    // Load Leaflet CSS
    const linkId = 'leaflet-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }

    // Dynamically import only leaflet (not react-leaflet)
    import('leaflet').then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      // Fix default marker icon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Create map
      const map = L.map(mapContainerRef.current).setView(mapCenter, mapZoom);
      mapRef.current = map;

      // Add initial tile layer
      const tileUrl = showSatellite ? SATELLITE_TILE : OSM_TILE;
      const attribution = showSatellite
        ? '&copy; <a href="https://www.esri.com/">Esri</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

      tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(map);

      setReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
      }
      setReady(false);
    };
    // Only run on mount/unmount — center & zoom handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refined coordinates from Nominatim geocoding
  const [refinedCoords, setRefinedCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());

  // Async Nominatim geocoding for approximate parcels (runs after initial render)
  useEffect(() => {
    let cancelled = false;

    const approximateParcels = mappableParcels.filter((p) => p.approximate);
    if (approximateParcels.length === 0) return;

    // Geocode sequentially with 1s delay between requests (Nominatim rate limit)
    (async () => {
      const results = new Map<string, { lat: number; lng: number }>();

      for (const { parcel } of approximateParcels) {
        if (cancelled) break;

        const coords = await geocodeParcel(parcel);
        if (coords && !cancelled) {
          results.set(parcel.id, coords);
          // Update incrementally
          setRefinedCoords(new Map(results));
        }

        // Rate limit: 1 request per second for Nominatim
        if (!cancelled) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mappableParcels]);

  // Merge refined coordinates with initial mappable parcels
  const finalParcels = useMemo(() => {
    return mappableParcels.map((mp) => {
      if (mp.approximate && refinedCoords.has(mp.parcel.id)) {
        const refined = refinedCoords.get(mp.parcel.id)!;
        return { ...mp, lat: refined.lat, lng: refined.lng, approximate: false, geocoded: true };
      }
      return { ...mp, geocoded: false };
    });
  }, [mappableParcels, refinedCoords]);

  // Update markers when parcels or refined coords change
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    import('leaflet').then((L) => {
      const map = mapRef.current;
      if (!map) return;

      // Remove existing markers
      map.eachLayer((layer: { options?: { pane?: string } }) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });

      // Custom icon for approximate (city-center) markers
      const approxIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
        className: 'leaflet-marker-approximate',
      });

      // Add markers for all parcels
      finalParcels.forEach(({ parcel, lat, lng, approximate, geocoded }) => {
        const markerOptions: Record<string, unknown> = {};
        if (approximate) {
          markerOptions.icon = approxIcon;
          markerOptions.opacity = 0.7;
        }

        const marker = L.marker([lat, lng], markerOptions).addTo(map);

        // Location label
        const approxLabel = approximate
          ? '<span style="display:inline-block;background:#f59e0b;color:#fff;font-size:10px;padding:1px 6px;border-radius:4px;margin-bottom:4px">~ Yaklaşık Konum</span><br/>'
          : geocoded
            ? '<span style="display:inline-block;background:#3b82f6;color:#fff;font-size:10px;padding:1px 6px;border-radius:4px;margin-bottom:4px">📍 Adrese göre konum</span><br/>'
            : '';

        // Popup content
        const popupHtml = `
          <div style="min-width:200px">
            ${approxLabel}
            <h3 style="font-weight:600;font-size:14px;margin:0">${parcel.title}</h3>
            <p style="font-size:12px;color:#666;margin:4px 0 0">
              📍 ${parcel.city}, ${parcel.district}
            </p>
            ${
              parcel.price
                ? `<p style="font-size:14px;font-weight:700;color:#16a34a;margin:4px 0 0">
                    ${parseFloat(parcel.price).toLocaleString('tr-TR')} ${parcel.currency || 'TRY'}
                  </p>`
                : ''
            }
            ${
              parcel.areaM2
                ? `<p style="font-size:12px;color:#888;margin:2px 0 0">
                    ${Number(parcel.areaM2).toLocaleString('tr-TR')} m²
                  </p>`
                : ''
            }
            <a href="/parcels/${parcel.id}"
               style="display:inline-block;margin-top:8px;font-size:12px;color:#2563eb;text-decoration:none">
              Detayları Gör →
            </a>
          </div>
        `;

        marker.bindPopup(popupHtml);

        if (onParcelClick) {
          marker.on('click', () => onParcelClick(parcel));
        }
      });

      // Fit bounds if we have parcels
      if (finalParcels.length > 1) {
        const bounds = L.latLngBounds(
          finalParcels.map((p) => [p.lat, p.lng]),
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      } else if (finalParcels.length === 1) {
        map.setView(
          [finalParcels[0].lat, finalParcels[0].lng],
          finalParcels[0].approximate ? 10 : 14,
        );
      }
    });
  }, [ready, finalParcels, onParcelClick]);

  // Handle satellite mode toggle
  const handleSatelliteToggle = useCallback(() => {
    setSatelliteMode((prev) => {
      const next = !prev;

      if (mapRef.current && tileLayerRef.current) {
        import('leaflet').then((L) => {
          const map = mapRef.current;
          if (!map) return;

          // Remove old tile layer
          if (tileLayerRef.current) {
            map.removeLayer(tileLayerRef.current);
          }

          // Add new tile layer
          const tileUrl = next ? SATELLITE_TILE : OSM_TILE;
          const attribution = next
            ? '&copy; <a href="https://www.esri.com/">Esri</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

          tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(map);
        });
      }

      return next;
    });
  }, []);

  return (
    <div className="relative rounded-lg overflow-hidden border border-[var(--border)]">
      {/* Satellite Toggle */}
      <button
        onClick={handleSatelliteToggle}
        className="absolute top-2 right-2 z-[1000] rounded-md bg-white px-3 py-1.5 text-xs font-medium shadow-md hover:bg-gray-100 transition-colors"
      >
        {satelliteMode ? '🗺 Normal' : '🛰 Uydu'}
      </button>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-[1000] rounded-md bg-white/90 px-3 py-2 text-xs shadow-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
            <span>{finalParcels.length} arsa gösteriliyor</span>
          </div>
          {finalParcels.some((p) => p.approximate) && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 opacity-70" />
              <span>{finalParcels.filter((p) => p.approximate).length} yaklaşık konum</span>
            </div>
          )}
        </div>
      </div>

      {/* Map container */}
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />

      {/* Loading overlay */}
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-[var(--muted)]"
          style={{ height }}
        >
          <p className="text-sm text-[var(--muted-foreground)]">Harita yükleniyor...</p>
        </div>
      )}
    </div>
  );
}
