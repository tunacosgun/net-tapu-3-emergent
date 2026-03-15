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
 * Prefers thumbnail → watermarked → original.
 * /uploads/... paths are proxied to the backend via Next.js rewrites.
 */
export function resolveImageUrl(img: {
  thumbnailUrl?: string | null;
  watermarkedUrl?: string | null;
  originalUrl?: string;
  url?: string;
}): string {
  const url = img.thumbnailUrl || img.watermarkedUrl || img.originalUrl || img.url || '';
  // Already absolute → use as-is
  if (url.startsWith('http')) return url;
  // Relative /uploads/... paths are proxied via Next.js rewrites
  return url;
}
