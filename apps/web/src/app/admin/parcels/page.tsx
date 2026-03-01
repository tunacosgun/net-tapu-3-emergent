'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatPrice, formatDate } from '@/lib/format';
import { PageHeader, DataTable, Badge, Pagination, type Column } from '@/components/ui';
import type { Parcel, PaginatedResponse } from '@/types';

const statusLabels: Record<string, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  deposit_taken: 'Depozito Alındı',
  sold: 'Satıldı',
  withdrawn: 'Geri Çekildi',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  sold: 'bg-blue-100 text-blue-700',
};

const columns: Column<Parcel>[] = [
  { header: 'Başlık', accessor: (p) => <span className="font-medium">{p.title}</span> },
  { header: 'Şehir', accessor: (p) => <span className="text-[var(--muted-foreground)]">{p.city}, {p.district}</span> },
  { header: 'Fiyat', accessor: (p) => <span className="font-mono">{formatPrice(p.price)}</span> },
  {
    header: 'Durum',
    accessor: (p) => (
      <Badge className={statusColors[p.status] || 'bg-gray-100 text-gray-700'}>
        {statusLabels[p.status] || p.status}
      </Badge>
    ),
  },
  {
    header: 'Tarih',
    accessor: (p) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(p.createdAt, 'date')}</span>,
  },
  {
    header: '',
    accessor: (p) => (
      <Link href={`/admin/parcels/${p.id}`} className="text-brand-500 hover:underline text-xs">Düzenle</Link>
    ),
  },
];

export default function AdminParcelsPage() {
  const [data, setData] = useState<PaginatedResponse<Parcel> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchParcels = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20, sortBy: 'createdAt', sortOrder: 'DESC' };
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params });
      setData(res);
    } catch (err) { showApiError(err); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchParcels(); }, [fetchParcels]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arsalar"
        action={
          <Link href="/admin/parcels/new" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
            Yeni Arsa
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

      {loading ? <TableSkeleton rows={8} cols={5} /> : data && (
        <>
          <DataTable
            columns={columns}
            data={data.data}
            keyExtractor={(p) => p.id}
          />
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
