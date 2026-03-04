'use client';

import type { Parcel } from '@/types';
import ParcelMapInner from './parcel-map-inner';

interface ParcelMapProps {
  parcels: Parcel[];
  onParcelClick?: (parcel: Parcel) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  showSatellite?: boolean;
}

/**
 * Public wrapper for the map component.
 * ParcelMapInner handles all lazy loading of Leaflet internally via useEffect.
 */
export function ParcelMap(props: ParcelMapProps) {
  return <ParcelMapInner {...props} />;
}
