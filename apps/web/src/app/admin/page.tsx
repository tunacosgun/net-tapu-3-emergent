'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { StatCard, LoadingState } from '@/components/ui';
import type { ReconciliationReport } from '@/types';

interface FinanceSummary {
  total_captured_amount: string;
  total_refunded_amount: string;
  total_settled_auctions: number;
  total_failed_settlements: number;
}

export default function AdminDashboard() {
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [recon, setRecon] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const results = await Promise.allSettled([
        apiClient.get<FinanceSummary>('/admin/finance/summary'),
        apiClient.get<ReconciliationReport>('/admin/reconciliation'),
      ]);

      if (cancelled) return;

      if (results[0].status === 'fulfilled') setFinance(results[0].value.data);
      if (results[1].status === 'fulfilled') setRecon(results[1].value.data);
      setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <LoadingState centered={false} />;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Yönetim Paneli</h1>

      {/* Finance summary */}
      {finance && (
        <div>
          <h2 className="text-lg font-semibold">Finansal Özet</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Toplam Tahsilat"
              value={formatPrice(finance.total_captured_amount)}
            />
            <StatCard
              label="Toplam İade"
              value={formatPrice(finance.total_refunded_amount)}
            />
            <StatCard
              label="Sonuçlanan Açık Artırmalar"
              value={String(finance.total_settled_auctions)}
            />
            <StatCard
              label="Başarısız Sonuçlandırmalar"
              value={String(finance.total_failed_settlements)}
              variant={finance.total_failed_settlements > 0 ? 'danger' : 'default'}
            />
          </div>
        </div>
      )}

      {/* Reconciliation */}
      {recon && (
        <div>
          <h2 className="text-lg font-semibold">Mutabakat</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Eşik: {recon.thresholdMinutes} dk | {new Date(recon.generatedAt).toLocaleString('tr-TR')}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Bekleyen Ödemeler"
              value={String(recon.stalePendingPayments.length)}
              variant={recon.stalePendingPayments.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Bekleyen İadeler"
              value={String(recon.stalePendingRefunds.length)}
              variant={recon.stalePendingRefunds.length > 0 ? 'danger' : 'default'}
            />
          </div>
        </div>
      )}

      {!finance && !recon && (
        <p className="text-[var(--muted-foreground)]">
          Henüz veri bulunmuyor.
        </p>
      )}
    </div>
  );
}
