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
