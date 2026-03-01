'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatDate } from '@/lib/format';
import { PageHeader, DataTable, Badge, Pagination, type Column } from '@/components/ui';
import type { ContactRequest, PaginatedResponse } from '@/types';

const typeLabels: Record<string, string> = { call_me: 'Beni Ara', parcel_inquiry: 'Arsa Sorgulama', general: 'Genel' };
const statusLabels: Record<string, string> = { new: 'Yeni', assigned: 'Atandı', in_progress: 'İşlemde', completed: 'Tamamlandı', cancelled: 'İptal' };
const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', assigned: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-700',
};

export default function AdminContactsPage() {
  const [data, setData] = useState<PaginatedResponse<ContactRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await apiClient.get<PaginatedResponse<ContactRequest>>('/crm/contact-requests', { params });
      setData(res);
    } catch (err) { showApiError(err); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  async function updateStatus(id: string, newStatus: string) {
    setEditing(id);
    try {
      await apiClient.patch(`/crm/contact-requests/${id}`, { status: newStatus });
      await fetchContacts();
    } catch (err) { showApiError(err); }
    finally { setEditing(null); }
  }

  const columns: Column<ContactRequest>[] = [
    { header: 'İsim', accessor: (c) => <span className="font-medium">{c.name}</span> },
    { header: 'Telefon', accessor: (c) => <span className="text-xs font-mono">{c.phone}</span> },
    { header: 'Tür', accessor: (c) => <span className="text-xs">{typeLabels[c.type] || c.type}</span> },
    {
      header: 'Durum',
      accessor: (c) => (
        <Badge className={statusColors[c.status] || ''}>
          {statusLabels[c.status] || c.status}
        </Badge>
      ),
    },
    { header: 'Mesaj', accessor: (c) => <span className="text-xs text-[var(--muted-foreground)] max-w-[200px] truncate block">{c.message || '—'}</span> },
    { header: 'Tarih', accessor: (c) => <span className="text-xs text-[var(--muted-foreground)]">{formatDate(c.createdAt)}</span> },
    {
      header: '',
      accessor: (c) => (
        <select
          value={c.status}
          onChange={(e) => updateStatus(c.id, e.target.value)}
          disabled={editing === c.id}
          className="rounded border border-[var(--input)] bg-[var(--background)] px-2 py-0.5 text-xs disabled:opacity-50"
        >
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="İletişim Talepleri" />

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
            keyExtractor={(c) => c.id}
          />
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
