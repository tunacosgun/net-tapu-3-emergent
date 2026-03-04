'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { Card, Badge, Alert, EmptyState, LoadingState } from '@/components/ui';
import type { Payment } from '@/types';

const paymentStatusMap: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; label: string }> = {
  pending: { variant: 'warning', label: 'Bekliyor' },
  processing: { variant: 'info', label: 'İşleniyor' },
  completed: { variant: 'success', label: 'Tamamlandı' },
  failed: { variant: 'danger', label: 'Başarısız' },
  refunded: { variant: 'default', label: 'İade Edildi' },
  cancelled: { variant: 'default', label: 'İptal' },
  three_ds_pending: { variant: 'warning', label: '3D Onay Bekliyor' },
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
      .get<Payment[]>('/payments', { params: { mine: true } })
      .then(({ data }) => setPayments(Array.isArray(data) ? data : []))
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
      <h2 className="text-lg font-semibold">Ödeme Geçmişim</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Tüm ödeme ve işlem kayıtlarınız
      </p>

      {/* Summary Cards */}
      {payments.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Toplam İşlem"
            value={String(payments.length)}
          />
          <SummaryCard
            label="Başarılı Ödeme"
            value={String(completedPayments.length)}
          />
          <SummaryCard
            label="Toplam Ödenen"
            value={formatPrice(String(totalPaid))}
          />
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState message="Henüz ödeme kaydınız yok." />
      ) : (
        <div className="mt-6 space-y-3">
          {payments.map((payment) => {
            const ps = paymentStatusMap[payment.status] || {
              variant: 'default' as const,
              label: payment.status,
            };
            const methodLabel = paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod;

            return (
              <Card key={payment.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        #{payment.id.slice(0, 8).toUpperCase()}
                      </span>
                      <Badge variant={ps.variant}>{ps.label}</Badge>
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {methodLabel}
                      </span>
                    </div>

                    {payment.description && (
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {payment.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]">
                      {payment.parcelId && (
                        <Link
                          href={`/parcels/${payment.parcelId}`}
                          className="hover:text-brand-500"
                        >
                          Arsa: {payment.parcelId.slice(0, 8)}...
                        </Link>
                      )}
                      {payment.auctionId && (
                        <Link
                          href={`/auctions/${payment.auctionId}`}
                          className="hover:text-brand-500"
                        >
                          İhale: {payment.auctionId.slice(0, 8)}...
                        </Link>
                      )}
                      <span>{formatDate(payment.createdAt, 'datetime')}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-brand-500">
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </Card>
  );
}
