'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { Card, Badge, Alert, EmptyState, LoadingState } from '@/components/ui';
import type { Payment } from '@/types';

const paymentStatusMap: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; label: string; icon: string }> = {
  pending: { variant: 'warning', label: 'Bekliyor', icon: '⏳' },
  processing: { variant: 'info', label: 'İşleniyor', icon: '🔄' },
  completed: { variant: 'success', label: 'Tamamlandı', icon: '✅' },
  failed: { variant: 'danger', label: 'Başarısız', icon: '❌' },
  refunded: { variant: 'default', label: 'İade Edildi', icon: '↩️' },
  cancelled: { variant: 'default', label: 'İptal', icon: '🚫' },
  three_ds_pending: { variant: 'warning', label: '3D Onay Bekliyor', icon: '🔐' },
};

const paymentMethodLabels: Record<string, string> = {
  credit_card: 'Kredi Kartı',
  bank_transfer: 'Havale/EFT',
  virtual_pos: 'Sanal POS',
  cash: 'Nakit',
};

export default function PaymentsHistoryPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Payment[] | { data: Payment[] }>('/payments')
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : (data as any)?.data ?? [];
        setPayments(items);
      })
      .catch(() => setError('Ödeme geçmişi yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <Alert>{error}</Alert>;

  // Calculate totals
  const completedPayments = payments.filter((p) => p.status === 'completed');
  const totalPaid = completedPayments.reduce(
    (sum, p) => sum + parseFloat(p.amount || '0'),
    0,
  );

  return (
    <div>
      <h2 className="text-xl font-bold">Ödeme Geçmişim</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Tüm ödeme ve işlem kayıtlarınız
      </p>

      {/* Summary Cards */}
      {payments.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4 text-center">
            <p className="text-2xl font-bold">{payments.length}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Toplam İşlem</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completedPayments.length}</p>
            <p className="text-xs text-green-600/70">Başarılı Ödeme</p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 dark:bg-brand-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">{formatPrice(String(totalPaid))}</p>
            <p className="text-xs text-brand-600/70">Toplam Ödenen</p>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="mt-12">
          <EmptyState message="Henüz ödeme kaydınız yok." />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {payments.map((payment) => {
            const ps = paymentStatusMap[payment.status] || {
              variant: 'default' as const,
              label: payment.status,
              icon: '📋',
            };
            const methodLabel = paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod;

            return (
              <Card key={payment.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{ps.icon}</span>
                      <span className="font-semibold text-sm">
                        #{payment.id.slice(0, 8).toUpperCase()}
                      </span>
                      <Badge variant={ps.variant}>{ps.label}</Badge>
                      <span className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                        {methodLabel}
                      </span>
                    </div>

                    {payment.description && (
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                        {payment.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]">
                      {payment.parcelId && (
                        <Link
                          href={`/parcels/${payment.parcelId}`}
                          className="hover:text-brand-500 transition-colors"
                        >
                          🏞️ Arsa #{payment.parcelId.slice(0, 8).toUpperCase()}
                        </Link>
                      )}
                      {payment.auctionId && (
                        <Link
                          href={`/auctions/${payment.auctionId}`}
                          className="hover:text-brand-500 transition-colors"
                        >
                          🔨 İhale #{payment.auctionId.slice(0, 8).toUpperCase()}
                        </Link>
                      )}
                      <span>📅 {formatDate(payment.createdAt, 'datetime')}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-brand-500">
                      {formatPrice(payment.amount)}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {payment.currency}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
