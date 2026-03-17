'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { PageHeader, Card, Button, Alert, LoadingState } from '@/components/ui';
import { formatPrice, formatDate } from '@/lib/format';

interface BankTransfer {
  id: string;
  userId: string;
  auctionId: string | null;
  amount: string;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { email: string; firstName: string; lastName: string };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  provisioned: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Onay Bekliyor',
  provisioned: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
  failed: 'Başarısız',
};

export default function BankTransfersPage() {
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchTransfers() {
    try {
      const { data } = await apiClient.get('/admin/payments', {
        params: { paymentMethod: 'bank_transfer', limit: 100, sortBy: 'createdAt', sortOrder: 'DESC' },
      });
      setTransfers(data.data || data);
    } catch {
      setError('Havale listesi alınamadı.');
    }
    setLoading(false);
  }

  useEffect(() => { fetchTransfers(); }, []);

  async function handleAction(id: string, action: 'verify' | 'reject') {
    setActionLoading(id);
    try {
      if (action === 'verify') {
        await apiClient.patch(`/admin/payments/${id}/capture`);
      } else {
        await apiClient.patch(`/admin/payments/${id}/cancel`);
      }
      await fetchTransfers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'İşlem başarısız.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    setActionLoading(null);
  }

  // Extract transfer code from description
  function getTransferCode(description: string | null): string {
    if (!description) return '—';
    const match = description.match(/Kod:\s*(NT-[A-Z0-9]+-[A-Z0-9]+)/);
    return match ? match[1] : '—';
  }

  const pendingCount = transfers.filter((t) => t.status === 'pending').length;

  if (loading) return <div className="p-8"><LoadingState /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Havale / EFT Yönetimi"
        description={`${transfers.length} havale işlemi${pendingCount > 0 ? ` • ${pendingCount} onay bekliyor` : ''}`}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Toplam', count: transfers.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Onay Bekleyen', count: pendingCount, color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Onaylanan', count: transfers.filter((t) => ['provisioned', 'completed'].includes(t.status)).length, color: 'bg-green-50 text-green-700' },
          { label: 'İptal / Red', count: transfers.filter((t) => ['cancelled', 'failed'].includes(t.status)).length, color: 'bg-red-50 text-red-700' },
        ].map((s) => (
          <Card key={s.label} className={`${s.color} text-center py-4`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-sm mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[var(--muted)] text-left">
                <th className="px-4 py-3 font-semibold">Transfer Kodu</th>
                <th className="px-4 py-3 font-semibold">Kullanıcı</th>
                <th className="px-4 py-3 font-semibold">Tutar</th>
                <th className="px-4 py-3 font-semibold">Durum</th>
                <th className="px-4 py-3 font-semibold">Tarih</th>
                <th className="px-4 py-3 font-semibold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--muted-foreground)]">
                    Henüz havale işlemi yok
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-[var(--muted)] transition-colors">
                    <td className="px-4 py-3">
                      <code className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                        {getTransferCode(t.description)}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--foreground)]">
                        {t.user ? `${t.user.firstName} ${t.user.lastName}` : t.userId.slice(0, 8)}
                      </span>
                      {t.user?.email && (
                        <span className="block text-xs text-[var(--muted-foreground)]">{t.user.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{formatPrice(t.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[t.status] || t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {formatDate(t.createdAt, 'datetime')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleAction(t.id, 'verify')}
                            disabled={actionLoading === t.id}
                          >
                            {actionLoading === t.id ? '...' : '✓ Onayla'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm('Bu havaleyi reddetmek istediğinize emin misiniz?')) {
                                handleAction(t.id, 'reject');
                              }
                            }}
                            disabled={actionLoading === t.id}
                          >
                            ✕ Reddet
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
