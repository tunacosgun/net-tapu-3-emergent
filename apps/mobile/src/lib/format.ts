import { Config } from '../config/env';

export function formatPrice(price: string | null): string {
  if (!price) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(parseFloat(price));
}

export function formatDate(dateStr: string, mode: 'date' | 'datetime' = 'datetime'): string {
  const date = new Date(dateStr);
  return mode === 'date'
    ? date.toLocaleDateString('tr-TR')
    : date.toLocaleString('tr-TR');
}

export function truncateId(id: string): string {
  return `${id.slice(0, 8)}...`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return formatDate(dateStr, 'date');
}

/**
 * Resolve the best available display URL for a ParcelImage.
 * Mobile: prepends API_BASE_URL for relative /uploads/ paths.
 */
export function resolveImageUrl(img: {
  thumbnailUrl?: string | null;
  watermarkedUrl?: string | null;
  originalUrl?: string;
  url?: string;
}): string {
  const url = img.thumbnailUrl || img.watermarkedUrl || img.originalUrl || img.url || '';
  if (!url) return '';
  if (url.startsWith('http')) return url;
  // Relative /uploads/... paths need full backend URL
  return `${Config.API_BASE_URL}${url}`;
}

export function formatArea(m2: string | null): string {
  if (!m2) return '—';
  const area = parseFloat(m2);
  if (area >= 10000) return `${(area / 10000).toFixed(1)} Hektar`;
  if (area >= 1000) return `${(area / 1000).toFixed(1)} Dönüm`;
  return `${area.toLocaleString('tr-TR')} m²`;
}
