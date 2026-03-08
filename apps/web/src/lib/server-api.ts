/**
 * Server-side API helpers for use in generateMetadata / server components.
 * These bypass the client-side axios interceptors and call the backend directly.
 */

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      next: { revalidate: 60 }, // cache for 60s
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface ServerParcel {
  id: string;
  title: string;
  description?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  price?: string;
  currency?: string;
  areaM2?: string;
  status: string;
  listingId?: string;
  [key: string]: unknown;
}

export interface ServerParcelImage {
  id: string;
  url?: string;
  originalUrl?: string;
  watermarkedUrl?: string;
  thumbnailUrl?: string;
  isCover?: boolean;
  sortOrder?: number;
}

export async function fetchParcelServer(id: string): Promise<ServerParcel | null> {
  return serverFetch<ServerParcel>(`/parcels/${id}`);
}

export async function fetchParcelImagesServer(id: string): Promise<ServerParcelImage[]> {
  return (await serverFetch<ServerParcelImage[]>(`/parcels/${id}/images`)) || [];
}

export async function fetchSiteSettingsServer(): Promise<Record<string, string>> {
  return (await serverFetch<Record<string, string>>('/content/site-settings')) || {};
}
