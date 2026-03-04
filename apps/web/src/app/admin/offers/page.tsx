'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatPrice, formatDate, truncateId } from '@/lib/format';
import { PageHeader, DataTable, Badge, Pagination, Button, type Column } from '@/components/ui';
import type { Offer, PaginatedResponse } from '@/types';

const statusLabels: Record<string, string> = {
  pending: 'Bekliyor', accepted: 'Kabul Edildi', rejected: 'Reddedildi',
  countered: 'Karşı Teklif', expired: 'Süresi Doldu', withdrawn: 'Geri Çekildi',
};
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700', countered: 'bg-blue-100 text-blue-700',
  expired: 'bg-gray-100 text-gray-700', withdrawn: 'bg-gray-100 text-gray-700',
};

export default function AdminOffersPage() {
  const [data, setData] = useState<PaginatedResponse<Offer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [responding, setResponding] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await apiClient.get<PaginatedResponse<Offer>>('/crm/offers', { params });
      setData(res);
    } catch (err) { showApiError(err); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  async function respondToOffer(offerId: string, responseType: 'accept' | 'reject', counterAmount?: string) {
    setResponding(offerId);
    try {
      await apiClient.post(`/crm/offers/${offerId}/respond`, {
        responseType,
        counterAmount: counterAmount || undefined,
      });
      await fetchOffers();
    } catch (err) { showApiError(err); }
    finally { setResponding(null); }
  }

  const columns: Column<Offer>[] = [
    { header: 'Kullanıcı', accessor: (o) => <span className="text-xs font-mono">{truncateId(o.userId)}</span> },
    { header: 'Arsa', accessor: (o) => <span className="text-xs font-mono">{truncateId(o.parcelId)}</span> },
    { header: 'Tutar', accessor: (o) => <span className="font-mono font-semibold">{formatPrice(o.amount)}</span> },
    {
      header: 'Durum',
      accessor: (o) => (
        <Badge className={statusColors[o.status] || ''}>
          {statusLabels[o.status] || o.status}
        </Badge>
      ),
    },
    { header: 'Mesaj', accessor: (o) => <span className="text-xs text-[var(--muted-foreground)] max-w-[200px] truncate block">{o.message || '—'}</span> },
    { header: 'Tarih', accessor: (o) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(o.createdAt)}</span> },
    {
      header: '',
      accessor: (o) => o.status === 'pending' ? (
        <div className="flex gap-1">
          <button onClick={() => respondToOffer(o.id, 'accept')} disabled={responding === o.id}
            className="rounded bg-green-500 px-2 py-0.5 text-xs text-white hover:bg-green-600 disabled:opacity-50">
            Kabul
          </button>
          <button onClick={() => respondToOffer(o.id, 'reject')} disabled={responding === o.id}
            className="rounded bg-red-500 px-2 py-0.5 text-xs text-white hover:bg-red-600 disabled:opacity-50">
            Reddet
          </button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Teklifler" />

      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="">Tüm Durumlar</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? <TableSkeleton rows={8} cols={7} /> : data && (
        <>
          <DataTable
            columns={columns}
            data={data.data}
            keyExtractor={(o) => o.id}
          />
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
