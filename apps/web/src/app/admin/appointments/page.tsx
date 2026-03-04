'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatDate } from '@/lib/format';
import { PageHeader, DataTable, Badge, Pagination, Button, type Column } from '@/components/ui';
import type { Appointment, PaginatedResponse } from '@/types';

const statusLabels: Record<string, string> = {
  scheduled: 'Planlandı', confirmed: 'Onaylandı', completed: 'Tamamlandı', cancelled: 'İptal', no_show: 'Gelmedi',
};
const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700', confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-700', cancelled: 'bg-red-100 text-red-700', no_show: 'bg-yellow-100 text-yellow-700',
};

export default function AdminAppointmentsPage() {
  const [data, setData] = useState<PaginatedResponse<Appointment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await apiClient.get<PaginatedResponse<Appointment>>('/crm/appointments', { params });
      setData(res);
    } catch (err) { showApiError(err); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiClient.post('/crm/appointments', {
        userId: fd.get('userId') || undefined,
        parcelId: fd.get('parcelId') || undefined,
        consultantId: fd.get('consultantId') || undefined,
        scheduledAt: new Date(fd.get('scheduledAt') as string).toISOString(),
        durationMinutes: Number(fd.get('durationMinutes')) || 30,
        location: fd.get('location') || undefined,
        notes: fd.get('notes') || undefined,
      });
      setShowCreate(false);
      await fetchAppointments();
    } catch (err) { showApiError(err); }
    finally { setCreating(false); }
  }

  async function updateStatus(id: string, newStatus: string) {
    setEditing(id);
    try {
      await apiClient.patch(`/crm/appointments/${id}`, { status: newStatus });
      await fetchAppointments();
    } catch (err) { showApiError(err); }
    finally { setEditing(null); }
  }

  const columns: Column<Appointment>[] = [
    { header: 'Tarih', accessor: (a) => <span className="text-xs">{formatDate(a.scheduledAt)}</span> },
    { header: 'Süre', accessor: (a) => <span className="text-xs">{a.durationMinutes} dk</span> },
    { header: 'Konum', accessor: (a) => <span className="text-xs">{a.location || '—'}</span> },
    {
      header: 'Durum',
      accessor: (a) => (
        <Badge className={statusColors[a.status] || ''}>
          {statusLabels[a.status] || a.status}
        </Badge>
      ),
    },
    { header: 'Notlar', accessor: (a) => <span className="text-xs text-[var(--muted-foreground)] max-w-[200px] truncate block">{a.notes || '—'}</span> },
    {
      header: '',
      accessor: (a) => (
        <select value={a.status} onChange={(e) => updateStatus(a.id, e.target.value)} disabled={editing === a.id}
          className="rounded border border-[var(--input)] bg-[var(--background)] px-2 py-0.5 text-xs disabled:opacity-50">
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Randevular"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'İptal' : 'Yeni Randevu'}
          </Button>
        }
      />

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium">Tarih/Saat *</label>
              <input type="datetime-local" name="scheduledAt" required
                className="mt-1 block w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium">Süre (dk)</label>
              <input type="number" name="durationMinutes" defaultValue="30"
                className="mt-1 block w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium">Kullanıcı ID</label>
              <input type="text" name="userId" className="mt-1 block w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium">Arsa ID</label>
              <input type="text" name="parcelId" className="mt-1 block w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium">Danışman ID</label>
              <input type="text" name="consultantId" className="mt-1 block w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium">Konum</label>
            <input type="text" name="location" className="mt-1 block w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium">Notlar</label>
            <textarea name="notes" rows={2} className="mt-1 block w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm" />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? 'Oluşturuluyor...' : 'Oluştur'}
          </Button>
        </form>
      )}

      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="">Tüm Durumlar</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? <TableSkeleton rows={6} cols={6} /> : data && (
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
