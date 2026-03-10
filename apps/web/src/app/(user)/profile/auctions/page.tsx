'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { Card, Badge, Alert, EmptyState, LoadingState, Button } from '@/components/ui';
import type { Deposit } from '@/types';

const depositStatusMap: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; label: string; icon: string }> = {
  collected: { variant: 'info', label: 'Tahsil Edildi', icon: '💰' },
  held: { variant: 'warning', label: 'Bekletiliyor', icon: '⏳' },
  captured: { variant: 'success', label: 'Alındı', icon: '✅' },
  refund_pending: { variant: 'warning', label: 'İade Bekliyor', icon: '🔄' },
  refunded: { variant: 'default', label: 'İade Edildi', icon: '↩️' },
  expired: { variant: 'danger', label: 'Süresi Doldu', icon: '⏰' },
};

export default function AuctionsHistoryPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Deposit[]>('/deposits')
      .then(({ data }) => setDeposits(Array.isArray(data) ? data : []))
      .catch(() => setError('İhale geçmişi yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <Alert>{error}</Alert>;

  // Group deposits by auction
  const auctionMap = new Map<string, Deposit[]>();
  deposits.forEach((d) => {
    const existing = auctionMap.get(d.auctionId) || [];
    existing.push(d);
    auctionMap.set(d.auctionId, existing);
  });

  // Stats
  const activeDeposits = deposits.filter((d) => ['collected', 'held'].includes(d.status)).length;
  const totalDeposited = deposits.reduce((sum, d) => sum + parseFloat(d.amount || '0'), 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">İhale Geçmişim</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Katıldığınız açık artırmalar ve teminat bilgileriniz
          </p>
        </div>
        <Link href="/auctions">
          <Button size="sm">İhalelere Göz At</Button>
        </Link>
      </div>

      {/* Summary */}
      {deposits.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4 text-center">
            <p className="text-2xl font-bold">{auctionMap.size}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Katıldığınız İhale</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{activeDeposits}</p>
            <p className="text-xs text-amber-600/70">Aktif Teminat</p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 dark:bg-brand-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">{formatPrice(String(totalDeposited))}</p>
            <p className="text-xs text-brand-600/70">Toplam Teminat</p>
          </div>
        </div>
      )}

      {deposits.length === 0 ? (
        <div className="mt-12">
          <EmptyState message="Henüz bir ihaleye katılmadınız." />
          <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
            Açık artırmalara katılmak için depozito yatırmanız gerekmektedir.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {Array.from(auctionMap.entries()).map(([auctionId, auctionDeposits]) => {
            const latestDeposit = auctionDeposits[0];
            const ds = depositStatusMap[latestDeposit.status] || { variant: 'default' as const, label: latestDeposit.status, icon: '📋' };
            const isActive = ['collected', 'held'].includes(latestDeposit.status);
            return (
              <Card key={auctionId} className={`p-5 hover:shadow-md transition-shadow ${isActive ? 'border-l-4 border-l-brand-500' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{ds.icon}</span>
                      <Link
                        href={`/auctions/${auctionId}`}
                        className="font-semibold hover:text-brand-500 transition-colors"
                      >
                        İhale #{auctionId.slice(0, 8).toUpperCase()}
                      </Link>
                      <Badge variant={ds.variant}>{ds.label}</Badge>
                    </div>

                    <div className="mt-3 space-y-2">
                      {auctionDeposits.map((dep) => {
                        const dStatus = depositStatusMap[dep.status] || { variant: 'default' as const, label: dep.status, icon: '' };
                        const methodLabel: Record<string, string> = {
                          credit_card: 'Kredi Kartı',
                          bank_transfer: 'Havale/EFT',
                          mail_order: 'Mail Order',
                        };
                        return (
                          <div key={dep.id} className="flex items-center justify-between rounded-lg bg-[var(--muted)]/50 px-4 py-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-brand-500">
                                {formatPrice(dep.amount)}
                              </span>
                              <Badge variant={dStatus.variant} className="text-[10px]">{dStatus.label}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                              <span>{methodLabel[dep.paymentMethod] || dep.paymentMethod}</span>
                              <span>{formatDate(dep.createdAt, 'datetime')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {isActive && (
                    <Link href={`/auctions/${auctionId}`}>
                      <Button size="sm">İhaleye Git</Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
