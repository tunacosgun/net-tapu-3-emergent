'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface GeoJSONGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

interface AddressGeocoderProps {
  /** Current latitude value */
  latitude?: string;
  /** Current longitude value */
  longitude?: string;
  /** City name for geocoding context */
  city?: string;
  /** District name for geocoding context */
  district?: string;
  /** Neighborhood name for geocoding context */
  neighborhood?: string;
  /** Free-form address text */
  address?: string;
  /** Called when coordinates change (user click on map or geocode result) */
  onCoordsChange: (lat: string, lng: string) => void;
  /** Map height */
  height?: string;
  /** GeoJSON boundary polygon from TKGM */
  boundary?: GeoJSONGeometry | null;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type: string;
}

/**
 * Address geocoder component with mini Leaflet map.
 * - Auto-geocodes from city + district + neighborhood + address via Nominatim (OpenStreetMap)
 * - Shows a draggable pin on the map
 * - Allows clicking on the map to set coordinates manually
 * - Falls back to user-typed address if geocoding fails
 */
export function AddressGeocoder({
  latitude,
  longitude,
  city,
  district,
  neighborhood,
  address,
  onCoordsChange,
  height = '300px',
  boundary,
}: AddressGeocoderProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polygonRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<string>('');

  // Initialize map
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

    import('leaflet').then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      leafletRef.current = L;

      // Default center: Turkey
      const initLat = latitude ? parseFloat(latitude) : 39.0;
      const initLng = longitude ? parseFloat(longitude) : 35.0;
      const initZoom = latitude && longitude ? 14 : 6;

      const map = L.map(mapContainerRef.current).setView([initLat, initLng], initZoom);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Add marker if we have coordinates
      if (latitude && longitude) {
        const marker = L.marker([parseFloat(latitude), parseFloat(longitude)], {
          draggable: true,
        }).addTo(map);
        markerRef.current = marker;

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onCoordsChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
        });
      }

      // Click on map to set/move pin
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current = marker;

          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onCoordsChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
          });
        }

        onCoordsChange(lat.toFixed(6), lng.toFixed(6));
      });

      setReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        polygonRef.current = null;
        leafletRef.current = null;
      }
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng props change externally
  useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;

    const L = leafletRef.current;

    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
        markerRef.current = marker;

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onCoordsChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
        });
      }

      mapRef.current.setView([lat, lng], 14);
    }
  }, [ready, latitude, longitude, onCoordsChange]);

  // Draw boundary polygon when available
  useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    // Remove previous polygon
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    if (!boundary || !boundary.coordinates) return;

    try {
      const geoLayer = L.geoJSON(boundary, {
        style: {
          color: '#dc2626',
          weight: 3,
          fillColor: '#dc2626',
          fillOpacity: 0.15,
        },
      }).addTo(map);

      polygonRef.current = geoLayer;

      // Fit map to polygon bounds
      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      }
    } catch {
      // Invalid boundary data, ignore
    }
  }, [ready, boundary]);

  // Geocode address via Nominatim
  const geocodeAddress = useCallback(async () => {
    if (!city) {
      setGeocodeStatus('Önce şehir seçin');
      return;
    }

    setGeocoding(true);
    setGeocodeStatus('Konum aranıyor...');

    // Build query from most specific to least specific
    const parts: string[] = [];
    if (address) parts.push(address);
    if (neighborhood) parts.push(neighborhood);
    if (district) parts.push(district);
    if (city) parts.push(city);
    parts.push('Türkiye');

    const query = parts.join(', ');

    try {
      // Try full query first
      let results = await nominatimSearch(query);

      // If no result, try without address (just neighborhood + district + city)
      if (results.length === 0 && address) {
        const fallbackParts = [];
        if (neighborhood) fallbackParts.push(neighborhood);
        if (district) fallbackParts.push(district);
        if (city) fallbackParts.push(city);
        fallbackParts.push('Türkiye');
        results = await nominatimSearch(fallbackParts.join(', '));
      }

      // If still no result, try just district + city
      if (results.length === 0 && neighborhood) {
        results = await nominatimSearch(`${district}, ${city}, Türkiye`);
      }

      // If still no result, try just city
      if (results.length === 0) {
        results = await nominatimSearch(`${city}, Türkiye`);
      }

      if (results.length > 0) {
        const best = results[0];
        onCoordsChange(parseFloat(best.lat).toFixed(6), parseFloat(best.lon).toFixed(6));
        setGeocodeStatus(`✓ Konum bulundu: ${best.display_name.substring(0, 60)}...`);
      } else {
        setGeocodeStatus('✗ Konum bulunamadı. Haritada tıklayarak pin ekleyebilirsiniz.');
      }
    } catch {
      setGeocodeStatus('✗ Geocoding hatası. Haritada tıklayarak pin ekleyebilirsiniz.');
    } finally {
      setGeocoding(false);
    }
  }, [city, district, neighborhood, address, onCoordsChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Konum (Harita)</label>
        <button
          type="button"
          onClick={geocodeAddress}
          disabled={geocoding || !city}
          className="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {geocoding ? '🔄 Aranıyor...' : '📍 Adresten Otomatik Bul'}
        </button>
      </div>

      {geocodeStatus && (
        <p className={`text-xs ${geocodeStatus.startsWith('✓') ? 'text-green-600' : geocodeStatus.startsWith('✗') ? 'text-red-500' : 'text-amber-600'}`}>
          {geocodeStatus}
        </p>
      )}

      {/* Mini map */}
      <div className="relative rounded-lg overflow-hidden border border-[var(--border)]">
        <div ref={mapContainerRef} style={{ height, width: '100%' }} />

        {!ready && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-[var(--muted)]"
          >
            <p className="text-sm text-[var(--muted-foreground)]">Harita yükleniyor...</p>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">
        Haritada tıklayarak pin koyabilir veya pini sürükleyerek konumu ayarlayabilirsiniz.
      </p>

      {/* Coordinate display */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Enlem (Latitude)</label>
          <input
            type="text"
            value={latitude || ''}
            onChange={(e) => onCoordsChange(e.target.value, longitude || '')}
            placeholder="Ör: 36.8969"
            className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Boylam (Longitude)</label>
          <input
            type="text"
            value={longitude || ''}
            onChange={(e) => onCoordsChange(latitude || '', e.target.value)}
            placeholder="Ör: 30.7133"
            className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm font-mono"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Search Nominatim (OpenStreetMap) geocoding API.
 * Free tier: 1 request/second, requires User-Agent.
 */
async function nominatimSearch(query: string): Promise<NominatimResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('countrycodes', 'tr');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'NetTapu-Platform/1.0',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }

  return response.json();
}
