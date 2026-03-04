'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatPrice, formatDate } from '@/lib/format';
import { PageHeader, DataTable, Badge, Pagination, type Column } from '@/components/ui';
import type { Auction, PaginatedResponse } from '@/types';

const statusLabels: Record<string, string> = {
  draft: 'Taslak', scheduled: 'Planlandı', deposit_open: 'Depozito Açık', live: 'CANLI',
  ending: 'Bitiyor', ended: 'Bitti', settling: 'Sonuçlanıyor', settled: 'Sonuçlandı',
  settlement_failed: 'Başarısız', cancelled: 'İptal',
};

const statusColors: Record<string, string> = {
  live: 'bg-green-100 text-green-700', ending: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700', deposit_open: 'bg-blue-100 text-blue-700',
  ended: 'bg-gray-100 text-gray-700', settled: 'bg-gray-100 text-gray-700',
  settlement_failed: 'bg-red-100 text-red-700', cancelled: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-700',
};

const columns: Column<Auction>[] = [
  { header: 'Başlık', accessor: (a) => <span className="font-medium">{a.title}</span> },
  {
    header: 'Durum',
    accessor: (a) => (
      <Badge className={statusColors[a.status] || 'bg-gray-100 text-gray-700'}>
        {statusLabels[a.status] || a.status}
      </Badge>
    ),
  },
  { header: 'Güncel Fiyat', accessor: (a) => <span className="font-mono">{formatPrice(a.currentPrice)}</span> },
  { header: 'Teklifler', accessor: (a) => a.bidCount },
  {
    header: 'Başlangıç',
    accessor: (a) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(a.scheduledStart)}</span>,
  },
  {
    header: '',
    accessor: (a) => (
      <Link href={`/admin/auctions/${a.id}`} className="text-brand-500 hover:underline text-xs">Düzenle</Link>
    ),
  },
];

export default function AdminAuctionsPage() {
  const [data, setData] = useState<PaginatedResponse<Auction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await apiClient.get<PaginatedResponse<Auction>>('/auctions', { params });
      setData(res);
    } catch (err) { showApiError(err); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Açık Artırmalar"
        action={
          <Link href="/admin/auctions/new" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
            Yeni Açık Artırma
          </Link>
        }
      />

      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="">Tüm Durumlar</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? <TableSkeleton rows={8} cols={6} /> : data && (
        <>
          <DataTable
            columns={columns}
            data={data.data}
            keyExtractor={(a) => a.id}
          />
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
