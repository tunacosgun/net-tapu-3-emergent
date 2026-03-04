'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { PageHeader, DataTable, Badge, Pagination, Button, type Column } from '@/components/ui';
import { TableSkeleton } from '@/components/skeleton';
import { formatPrice, formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: 'draft' | 'active' | 'paused' | 'ended';
  startDate: string;
  endDate: string;
  discountPercentage: number | null;
  discountAmount: string | null;
  assignmentCount: number;
  createdAt: string;
}

const statusMap: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  draft: { variant: 'default', label: 'Taslak' },
  active: { variant: 'success', label: 'Aktif' },
  paused: { variant: 'warning', label: 'Duraklatıldı' },
  ended: { variant: 'danger', label: 'Bitti' },
};

const typeLabels: Record<string, string> = {
  discount: 'İndirim',
  promotion: 'Promosyon',
  spin_wheel: 'Çark',
  referral: 'Referans',
};

export default function AdminCampaignsPage() {
  const [data, setData] = useState<PaginatedResponse<Campaign> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await apiClient.get<PaginatedResponse<Campaign>>('/admin/campaigns', {
        params: { page, limit: 20 },
      });
      setData(res);
    } catch {
      // Endpoint may not exist yet
      setData({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<Campaign>[] = [
    {
      header: 'Kampanya Adı',
      accessor: (c) => (
        <Link href={`/admin/campaigns/${c.id}`} className="font-medium hover:text-brand-500">
          {c.name}
        </Link>
      ),
    },
    {
      header: 'Tür',
      accessor: (c) => (
        <span className="text-sm">{typeLabels[c.type] || c.type}</span>
      ),
    },
    {
      header: 'İndirim',
      accessor: (c) => (
        <span className="text-sm font-medium">
          {c.discountPercentage ? `%${c.discountPercentage}` : c.discountAmount ? formatPrice(c.discountAmount) : '—'}
        </span>
      ),
    },
    {
      header: 'Durum',
      accessor: (c) => {
        const st = statusMap[c.status] || { variant: 'default' as const, label: c.status };
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
    {
      header: 'Tarih Aralığı',
      accessor: (c) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDate(c.startDate, 'date')} — {formatDate(c.endDate, 'date')}
        </span>
      ),
    },
    {
      header: 'Atama',
      accessor: (c) => (
        <span className="text-sm">{c.assignmentCount || 0}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kampanyalar"
        subtitle="Kampanya ve promosyon yönetimi"
        action={
          <Link
            href="/admin/campaigns/new"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            Yeni Kampanya
          </Link>
        }
      />

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : data && data.data.length > 0 ? (
        <>
          <DataTable columns={columns} data={data.data} keyExtractor={(c) => c.id} />
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <p className="text-lg font-medium">Henüz kampanya oluşturulmadı</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            İlk kampanyanızı oluşturmak için yukarıdaki butonu kullanın.
          </p>
          <Link
            href="/admin/campaigns/new"
            className="mt-4 inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Kampanya Oluştur
          </Link>
        </div>
      )}
    </div>
  );
}
