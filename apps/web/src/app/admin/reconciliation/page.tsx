'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { formatPrice } from '@/lib/format';
import { truncateId } from '@/lib/format';
import { StatCard, Badge, Button, PageHeader } from '@/components/ui';
import type { ReconciliationReport, SettlementManifest } from '@/types';

interface SettlementsResponse {
  data: SettlementManifest[];
  meta: { total: number; limit: number; offset: number };
}

const manifestStatusLabels: Record<string, string> = {
  active: 'Aktif', completed: 'Tamamlandı', expired: 'Süresi Doldu', escalated: 'Eskalasyon',
};

const manifestStatusColors: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700',
  expired: 'bg-yellow-100 text-yellow-700', escalated: 'bg-red-100 text-red-700',
};

export default function AdminReconciliationPage() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [settlements, setSettlements] = useState<SettlementManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const { cooldown, isLimited, checkRateLimit } = useRateLimit();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      apiClient.get<ReconciliationReport>('/admin/reconciliation'),
      apiClient.get<SettlementsResponse>('/admin/settlements', { params: { limit: 50 } }),
    ]);
    if (results[0].status === 'fulfilled') setReport(results[0].value.data);
    if (results[1].status === 'fulfilled') setSettlements(results[1].value.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function triggerReconciliation() {
    setTriggering(true);
    try {
      await apiClient.post('/admin/reconciliation/trigger');
      await fetchData();
    } catch (err) {
      if (!checkRateLimit(err)) showApiError(err);
    } finally {
      setTriggering(false);
    }
  }

  async function retrySettlement(manifestId: string) {
    setRetrying(manifestId);
    try {
      await apiClient.post(`/admin/settlements/${manifestId}/retry`);
      await fetchData();
    } catch (err) {
      if (!checkRateLimit(err)) showApiError(err);
    } finally {
      setRetrying(null);
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={5} />;

  const failedSettlements = settlements.filter((s) => s.status === 'expired' || s.status === 'escalated');
  const activeSettlements = settlements.filter((s) => s.status === 'active');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mutabakat"
        action={
          <Button
            onClick={triggerReconciliation}
            disabled={triggering || isLimited}
          >
            {isLimited
              ? `${cooldown}s bekleyin`
              : triggering
                ? 'Tetikleniyor...'
                : 'Manuel Mutabakat'}
          </Button>
        }
      />

      {/* Reconciliation report — stale records */}
      {report && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Eşik: {report.thresholdMinutes} dk | {new Date(report.generatedAt).toLocaleString('tr-TR')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Bekleyen Ödemeler"
              value={String(report.stalePendingPayments.length)}
              variant={report.stalePendingPayments.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Bekleyen İadeler"
              value={String(report.stalePendingRefunds.length)}
              variant={report.stalePendingRefunds.length > 0 ? 'danger' : 'default'}
            />
          </div>

          {/* Stale payments table */}
          {report.stalePendingPayments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-yellow-700">Bekleyen Ödemeler</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                      <th className="pb-2 pr-4">ID</th>
                      <th className="pb-2 pr-4">Tutar</th>
                      <th className="pb-2 pr-4">Durum</th>
                      <th className="pb-2 pr-4">Bekleme (dk)</th>
                      <th className="pb-2">Kullanıcı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.stalePendingPayments.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--border)]">
                        <td className="py-2 pr-4 text-xs font-mono">{truncateId(p.id)}</td>
                        <td className="py-2 pr-4">{formatPrice(p.amount)} {p.currency}</td>
                        <td className="py-2 pr-4">
                          <Badge className="bg-yellow-100 text-yellow-700">
                            {p.status === 'pending' ? 'Beklemede' : p.status === 'awaiting_3ds' ? '3DS Bekliyor' : p.status === 'provisioned' ? 'Onaylandı' : p.status === 'completed' ? 'Tamamlandı' : p.status === 'refunded' ? 'İade Edildi' : p.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs">{p.staleSinceMinutes} dk</td>
                        <td className="py-2 text-xs font-mono">{truncateId(p.userId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stale refunds table */}
          {report.stalePendingRefunds.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-red-700">Bekleyen İadeler</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                      <th className="pb-2 pr-4">ID</th>
                      <th className="pb-2 pr-4">Tutar</th>
                      <th className="pb-2 pr-4">Durum</th>
                      <th className="pb-2 pr-4">Bekleme (dk)</th>
                      <th className="pb-2">Sebep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.stalePendingRefunds.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--border)]">
                        <td className="py-2 pr-4 text-xs font-mono">{truncateId(r.id)}</td>
                        <td className="py-2 pr-4">{formatPrice(r.amount)} {r.currency}</td>
                        <td className="py-2 pr-4">
                          <Badge className="bg-red-100 text-red-700">
                            {r.status === 'pending' ? 'Beklemede' : r.status === 'processing' ? 'İşleniyor' : r.status === 'completed' ? 'Tamamlandı' : r.status === 'failed' ? 'Başarısız' : r.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs">{r.staleSinceMinutes} dk</td>
                        <td className="py-2 text-xs">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Failed / escalated settlements — action required */}
      {failedSettlements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-red-700">Sorunlu Sonuçlandırmalar</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                  <th className="pb-2 pr-4">Manifest ID</th>
                  <th className="pb-2 pr-4">Auction ID</th>
                  <th className="pb-2 pr-4">Durum</th>
                  <th className="pb-2 pr-4">İlerleme</th>
                  <th className="pb-2 pr-4">Tarih</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {failedSettlements.map((s) => (
                  <tr key={s.manifest_id} className="border-b border-[var(--border)]">
                    <td className="py-3 pr-4 text-xs font-mono">{truncateId(s.manifest_id)}</td>
                    <td className="py-3 pr-4 text-xs font-mono">{truncateId(s.auction_id)}</td>
                    <td className="py-3 pr-4">
                      <Badge className={manifestStatusColors[s.status] || ''}>
                        {manifestStatusLabels[s.status] || s.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-xs">{s.items_acknowledged}/{s.items_total}</td>
                    <td className="py-3 pr-4 text-xs text-[var(--muted-foreground)]">{new Date(s.created_at).toLocaleString('tr-TR')}</td>
                    <td className="py-3">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => retrySettlement(s.manifest_id)}
                        disabled={retrying === s.manifest_id}
                      >
                        {retrying === s.manifest_id ? 'Yeniden...' : 'Yeniden Dene'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active settlements */}
      {activeSettlements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Aktif Sonuçlandırmalar</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                  <th className="pb-2 pr-4">Manifest ID</th>
                  <th className="pb-2 pr-4">Auction ID</th>
                  <th className="pb-2 pr-4">İlerleme</th>
                  <th className="pb-2 pr-4">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {activeSettlements.map((s) => (
                  <tr key={s.manifest_id} className="border-b border-[var(--border)]">
                    <td className="py-3 pr-4 text-xs font-mono">{truncateId(s.manifest_id)}</td>
                    <td className="py-3 pr-4 text-xs font-mono">{truncateId(s.auction_id)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-[var(--muted)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-500 transition-all"
                            style={{ width: `${s.items_total > 0 ? (s.items_acknowledged / s.items_total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs">{s.items_acknowledged}/{s.items_total}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-[var(--muted-foreground)]">{new Date(s.created_at).toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All settlements */}
      <div>
        <h2 className="text-lg font-semibold">Tüm Sonuçlandırmalar ({settlements.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="pb-2 pr-4">Manifest</th>
                <th className="pb-2 pr-4">Auction</th>
                <th className="pb-2 pr-4">Durum</th>
                <th className="pb-2 pr-4">İlerleme</th>
                <th className="pb-2 pr-4">Oluşturulma</th>
                <th className="pb-2">Tamamlanma</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.manifest_id} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4 text-xs font-mono">{truncateId(s.manifest_id)}</td>
                  <td className="py-2 pr-4 text-xs font-mono">{truncateId(s.auction_id)}</td>
                  <td className="py-2 pr-4">
                    <Badge className={manifestStatusColors[s.status] || 'bg-gray-100 text-gray-700'}>
                      {manifestStatusLabels[s.status] || s.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-xs">{s.items_acknowledged}/{s.items_total}</td>
                  <td className="py-2 pr-4 text-xs text-[var(--muted-foreground)]">{new Date(s.created_at).toLocaleString('tr-TR')}</td>
                  <td className="py-2 text-xs text-[var(--muted-foreground)]">{s.completed_at ? new Date(s.completed_at).toLocaleString('tr-TR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
