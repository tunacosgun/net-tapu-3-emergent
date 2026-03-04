'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { PageHeader, DataTable, Badge, Button, Alert, Card, type Column } from '@/components/ui';
import { TableSkeleton } from '@/components/skeleton';
import { formatDate } from '@/lib/format';

interface IpBan {
  id: string;
  ipAddress: string;
  reason: string | null;
  bannedAt: string;
  expiresAt: string | null;
  createdBy: string | null;
}

interface LoginAttempt {
  id: string;
  ipAddress: string;
  email: string;
  success: boolean;
  userAgent: string | null;
  createdAt: string;
}

export default function AdminBansPage() {
  const [bans, setBans] = useState<IpBan[]>([]);
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBan, setShowAddBan] = useState(false);
  const [activeTab, setActiveTab] = useState<'bans' | 'attempts'>('bans');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bansRes, attemptsRes] = await Promise.allSettled([
        apiClient.get<IpBan[]>('/admin/bans'),
        apiClient.get<LoginAttempt[]>('/admin/bans/login-attempts', { params: { limit: 50 } }),
      ]);
      if (bansRes.status === 'fulfilled') setBans(bansRes.value.data || []);
      if (attemptsRes.status === 'fulfilled') setAttempts(attemptsRes.value.data || []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRemoveBan(banId: string) {
    try {
      await apiClient.delete(`/admin/bans/${banId}`);
      setBans((prev) => prev.filter((b) => b.id !== banId));
    } catch (err) {
      showApiError(err);
    }
  }

  const banColumns: Column<IpBan>[] = [
    { header: 'IP Adresi', accessor: (b) => <span className="font-mono text-sm">{b.ipAddress}</span> },
    { header: 'Sebep', accessor: (b) => <span className="text-sm">{b.reason || '—'}</span> },
    {
      header: 'Tarih',
      accessor: (b) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDate(b.bannedAt, 'datetime')}
        </span>
      ),
    },
    {
      header: 'Bitiş',
      accessor: (b) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {b.expiresAt ? formatDate(b.expiresAt, 'datetime') : 'Süresiz'}
        </span>
      ),
    },
    {
      header: '',
      accessor: (b) => (
        <Button variant="danger" size="sm" onClick={() => handleRemoveBan(b.id)}>
          Kaldır
        </Button>
      ),
    },
  ];

  const attemptColumns: Column<LoginAttempt>[] = [
    { header: 'IP Adresi', accessor: (a) => <span className="font-mono text-sm">{a.ipAddress}</span> },
    { header: 'E-posta', accessor: (a) => <span className="text-sm">{a.email}</span> },
    {
      header: 'Sonuç',
      accessor: (a) => (
        <Badge variant={a.success ? 'success' : 'danger'}>
          {a.success ? 'Başarılı' : 'Başarısız'}
        </Badge>
      ),
    },
    {
      header: 'Tarih',
      accessor: (a) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDate(a.createdAt, 'datetime')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yasaklamalar"
        subtitle="IP yasağı yönetimi ve giriş denemeleri"
        action={
          <Button onClick={() => setShowAddBan(true)}>Yeni Yasak Ekle</Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
        <button
          onClick={() => setActiveTab('bans')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'bans'
              ? 'bg-brand-500 text-white'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
          }`}
        >
          Aktif Yasaklar ({bans.length})
        </button>
        <button
          onClick={() => setActiveTab('attempts')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'attempts'
              ? 'bg-brand-500 text-white'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
          }`}
        >
          Giriş Denemeleri ({attempts.length})
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : activeTab === 'bans' ? (
        <DataTable
          columns={banColumns}
          data={bans}
          keyExtractor={(b) => b.id}
          emptyMessage="Aktif yasak bulunmuyor."
        />
      ) : (
        <DataTable
          columns={attemptColumns}
          data={attempts}
          keyExtractor={(a) => a.id}
          emptyMessage="Giriş denemesi kaydı bulunamadı."
        />
      )}

      {showAddBan && (
        <AddBanModal
          onClose={() => setShowAddBan(false)}
          onSuccess={() => {
            setShowAddBan(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function AddBanModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('permanent');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ip) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ipAddress: ip,
        reason: reason || null,
      };
      if (duration !== 'permanent') {
        const hours = parseInt(duration, 10);
        payload.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      }
      await apiClient.post('/admin/bans', payload);
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
        <h3 className="text-lg font-semibold">Yeni IP Yasağı</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">IP Adresi</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="Örn: 192.168.1.1"
              className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Sebep</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Opsiyonel"
              className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Süre</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="permanent">Süresiz</option>
              <option value="1">1 Saat</option>
              <option value="24">24 Saat</option>
              <option value="168">1 Hafta</option>
              <option value="720">30 Gün</option>
            </select>
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={saving}>
              {saving ? 'Ekleniyor...' : 'Yasak Ekle'}
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
