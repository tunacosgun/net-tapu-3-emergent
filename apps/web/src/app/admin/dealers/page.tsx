'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { PageHeader, DataTable, Badge, Button, Card, Alert, Pagination, type Column } from '@/components/ui';
import { TableSkeleton } from '@/components/skeleton';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';

interface Dealer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isVerified: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  portfolioCount: number;
  commissionRate: number | null;
  createdAt: string;
}

const statusMap: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  pending: { variant: 'warning', label: 'Başvuru Bekliyor' },
  approved: { variant: 'success', label: 'Onaylı' },
  rejected: { variant: 'danger', label: 'Reddedildi' },
  suspended: { variant: 'default', label: 'Askıda' },
};

export default function AdminDealersPage() {
  const [data, setData] = useState<PaginatedResponse<Dealer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await apiClient.get<PaginatedResponse<Dealer>>('/admin/dealers', { params });
      setData(res);
    } catch {
      setData({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleApprove(dealerId: string) {
    try {
      await apiClient.patch(`/admin/dealers/${dealerId}/approve`);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((d) =>
            d.id === dealerId ? { ...d, status: 'approved' as const } : d,
          ),
        };
      });
    } catch (err) {
      showApiError(err);
    }
  }

  async function handleReject(dealerId: string) {
    try {
      await apiClient.patch(`/admin/dealers/${dealerId}`, { status: 'rejected' });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((d) =>
            d.id === dealerId ? { ...d, status: 'rejected' as const } : d,
          ),
        };
      });
    } catch (err) {
      showApiError(err);
    }
  }

  const columns: Column<Dealer>[] = [
    {
      header: 'Danışman',
      accessor: (d) => (
        <div>
          <span className="font-medium">
            {[d.firstName, d.lastName].filter(Boolean).join(' ') || d.email}
          </span>
          {d.firstName && (
            <p className="text-xs text-[var(--muted-foreground)]">{d.email}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Telefon',
      accessor: (d) => <span className="text-sm">{d.phone || '—'}</span>,
    },
    {
      header: 'Durum',
      accessor: (d) => {
        const st = statusMap[d.status] || { variant: 'default' as const, label: d.status };
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
    {
      header: 'Portföy',
      accessor: (d) => <span className="text-sm font-medium">{d.portfolioCount || 0}</span>,
    },
    {
      header: 'Komisyon',
      accessor: (d) => (
        <span className="text-sm">
          {d.commissionRate ? `%${d.commissionRate}` : '—'}
        </span>
      ),
    },
    {
      header: 'Kayıt',
      accessor: (d) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDate(d.createdAt, 'date')}
        </span>
      ),
    },
    {
      header: '',
      accessor: (d) => (
        <div className="flex gap-1">
          {d.status === 'pending' && (
            <>
              <Button size="sm" onClick={() => handleApprove(d.id)}>
                Onayla
              </Button>
              <Button size="sm" variant="danger" onClick={() => handleReject(d.id)}>
                Reddet
              </Button>
            </>
          )}
          {d.status === 'approved' && (
            <Button size="sm" variant="secondary" onClick={() => handleReject(d.id)}>
              Askıya Al
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bayiler / Danışmanlar"
        subtitle="Bayi ve danışman yönetimi"
        action={
          <Button onClick={() => setShowAdd(true)}>Yeni Danışman</Button>
        }
      />

      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="">Tüm Durumlar</option>
          {Object.entries(statusMap).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : data && data.data.length > 0 ? (
        <>
          <DataTable columns={columns} data={data.data} keyExtractor={(d) => d.id} />
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <p className="text-lg font-medium">Henüz danışman kaydı yok</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Danışman başvuruları veya yeni eklenen danışmanlar burada görüntülenir.
          </p>
        </div>
      )}

      {showAdd && (
        <AddDealerModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function AddDealerModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSaving(true);
    try {
      await apiClient.post('/admin/dealers', {
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        commissionRate: commissionRate ? parseFloat(commissionRate) : null,
      });
      onSuccess();
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-lg bg-[var(--background)] p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Yeni Danışman Ekle</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">E-posta *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid gap-4 grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Ad</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Soyad</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Komisyon Oranı (%)</label>
            <input
              type="number"
              step="0.1"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="Örn: 2.5"
              className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Ekleniyor...' : 'Danışman Ekle'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              İptal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
