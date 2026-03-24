'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatPrice, formatDate, truncateId } from '@/lib/format';
import { PageHeader, DataTable, Badge, Pagination, type Column } from '@/components/ui';
import type { Deposit } from '@/types';

const statusLabels: Record<string, string> = {
  collected: 'Tahsil Edildi', held: 'Tutuldu', captured: 'Yakalandı',
  refund_pending: 'İade Bekliyor', refunded: 'İade Edildi', expired: 'Süresi Doldu',
};

const statusColors: Record<string, string> = {
  collected: 'bg-green-100 text-green-700', held: 'bg-blue-100 text-blue-700',
  captured: 'bg-purple-100 text-purple-700', refund_pending: 'bg-yellow-100 text-yellow-700',
  refunded: 'bg-gray-100 text-gray-700', expired: 'bg-red-100 text-red-700',
};

interface DepositsResponse {
  data: Deposit[];
  meta: { total: number; limit: number; offset: number };
}

const columns: Column<Deposit>[] = [
  { header: 'ID', accessor: (d) => <span className="text-xs font-mono">{truncateId(d.id)}</span> },
  {
    header: 'Kullanıcı',
    accessor: (d) => (
      <div>
        <span className="text-sm">
          {(d as any).user ? `${(d as any).user.firstName || ''} ${(d as any).user.lastName || ''}`.trim() || (d as any).user.email : truncateId(d.userId)}
        </span>
        {(d as any).user?.email && (
          <span className="block text-xs text-[var(--muted-foreground)]">{(d as any).user.email}</span>
        )}
      </div>
    ),
  },
  {
    header: 'Açık Artırma',
    accessor: (d) => (
      <span className="text-sm">
        {(d as any).auction?.title || truncateId(d.auctionId)}
      </span>
    ),
  },
  { header: 'Tutar', accessor: (d) => <span className="font-mono">{formatPrice(d.amount)}</span> },
  {
    header: 'Durum',
    accessor: (d) => (
      <Badge className={statusColors[d.status] || 'bg-gray-100 text-gray-700'}>
        {statusLabels[d.status] || d.status}
      </Badge>
    ),
  },
  {
    header: 'Tarih',
    accessor: (d) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(d.createdAt)}</span>,
  },
];

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const [statusFilter, setStatusFilter] = useState('');
  const [auctionIdFilter, setAuctionIdFilter] = useState('');

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit, offset };
      if (statusFilter) params.status = statusFilter;
      if (auctionIdFilter) params.auction_id = auctionIdFilter;
      const { data } = await apiClient.get<DepositsResponse>('/admin/finance/deposits', { params });
      setDeposits(data.data);
      setTotal(data.meta.total);
    } catch (err) { showApiError(err); }
    finally { setLoading(false); }
  }, [offset, statusFilter, auctionIdFilter]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Depozitolar" />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="">Tüm Durumlar</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input
          type="text"
          placeholder="Auction ID ile filtrele..."
          value={auctionIdFilter}
          onChange={(e) => { setAuctionIdFilter(e.target.value); setOffset(0); }}
          className="rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm w-64"
        />
      </div>

      {loading ? <TableSkeleton rows={8} cols={6} /> : (
        <>
          <DataTable
            columns={columns}
            data={deposits}
            keyExtractor={(d) => d.id}
          />
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setOffset((p - 1) * limit)}
          />
        </>
      )}
    </div>
  );
}
