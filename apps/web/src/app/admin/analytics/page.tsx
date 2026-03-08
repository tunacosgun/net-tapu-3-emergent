'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { StatCard, LoadingState, Card, PageHeader } from '@/components/ui';

interface AnalyticsOverview {
  parcels: {
    total: number;
    active: number;
    sold: number;
    deposit_taken: number;
    draft: number;
  };
  auctions: {
    total: number;
    live: number;
    scheduled: number;
    ended: number;
    settled: number;
  };
  users: {
    total: number;
    newThisMonth: number;
    verified: number;
  };
  finance: {
    totalRevenue: string;
    totalDeposits: string;
    totalRefunds: string;
  };
  crm: {
    contactRequests: number;
    pendingOffers: number;
    appointments: number;
  };
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    setLoading(true);
    // Try the analytics endpoint; fallback to constructing from individual endpoints
    apiClient
      .get<AnalyticsOverview>('/admin/analytics/overview', { params: { period } })
      .then(({ data }) => setData(data))
      .catch(async () => {
        // Fallback: aggregate from existing endpoints
        try {
          const [parcelsRes, auctionsRes] = await Promise.allSettled([
            apiClient.get('/parcels', { params: { limit: 1 } }),
            apiClient.get('/auctions', { params: { limit: 1 } }),
          ]);

          const fallback: AnalyticsOverview = {
            parcels: {
              total: parcelsRes.status === 'fulfilled' ? parcelsRes.value.data?.meta?.total || 0 : 0,
              active: 0,
              sold: 0,
              deposit_taken: 0,
              draft: 0,
            },
            auctions: {
              total: auctionsRes.status === 'fulfilled' ? auctionsRes.value.data?.meta?.total || 0 : 0,
              live: 0,
              scheduled: 0,
              ended: 0,
              settled: 0,
            },
            users: { total: 0, newThisMonth: 0, verified: 0 },
            finance: { totalRevenue: '0', totalDeposits: '0', totalRefunds: '0' },
            crm: { contactRequests: 0, pendingOffers: 0, appointments: 0 },
          };
          setData(fallback);
        } catch {
          setData(null);
        }
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader title="Analitik" subtitle="Platform genel performans metrikleri" />
        <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-brand-500 text-white'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              {p === 'week' ? 'Hafta' : p === 'month' ? 'Ay' : 'Yıl'}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="text-[var(--muted-foreground)]">Analitik verisi yüklenemedi.</p>
      ) : (
        <>
          {/* Parcels */}
          <section>
            <h2 className="text-lg font-semibold">Gayrimenkul</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Toplam Arsa" value={String(data.parcels.total)} />
              <StatCard label="Aktif İlan" value={String(data.parcels.active)} variant="success" />
              <StatCard label="Satıldı" value={String(data.parcels.sold)} />
              <StatCard label="Kaparo Alındı" value={String(data.parcels.deposit_taken)} variant="info" />
              <StatCard label="Taslak" value={String(data.parcels.draft)} />
            </div>
          </section>

          {/* Auctions */}
          <section>
            <h2 className="text-lg font-semibold">Açık Artırmalar</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Toplam" value={String(data.auctions.total)} />
              <StatCard label="Canlı" value={String(data.auctions.live)} variant="success" />
              <StatCard label="Planlanmış" value={String(data.auctions.scheduled)} variant="info" />
              <StatCard label="Biten" value={String(data.auctions.ended)} />
              <StatCard label="Sonuçlanan" value={String(data.auctions.settled)} />
            </div>
          </section>

          {/* Users */}
          <section>
            <h2 className="text-lg font-semibold">Kullanıcılar</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <StatCard label="Toplam Kullanıcı" value={String(data.users?.total ?? 0)} />
              <StatCard label="Bu Ay Yeni" value={String(data.users?.newThisMonth ?? 0)} variant="success" />
              <StatCard label="Doğrulanmış" value={String(data.users?.verified ?? 0)} />
            </div>
          </section>

          {/* Finance */}
          <section>
            <h2 className="text-lg font-semibold">Finans</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <StatCard label="Toplam Gelir" value={formatPrice(data.finance?.totalRevenue ?? '0')} size="lg" />
              <StatCard label="Toplam Depozito" value={formatPrice(data.finance?.totalDeposits ?? '0')} />
              <StatCard label="Toplam İade" value={formatPrice(data.finance?.totalRefunds ?? '0')} variant="danger" />
            </div>
          </section>

          {/* CRM */}
          <section>
            <h2 className="text-lg font-semibold">CRM</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <StatCard label="İletişim Talepleri" value={String(data.crm?.contactRequests ?? 0)} />
              <StatCard
                label="Bekleyen Teklifler"
                value={String(data.crm?.pendingOffers ?? 0)}
                variant={(data.crm?.pendingOffers ?? 0) > 0 ? 'warning' : 'default'}
              />
              <StatCard label="Randevular" value={String(data.crm?.appointments ?? 0)} />
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-lg font-semibold">Hızlı İşlemler</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionCard href="/admin/parcels/new" label="Yeni Arsa Ekle" icon="➕" />
              <QuickActionCard href="/admin/contacts" label="İletişim Talepleri" icon="📞" />
              <QuickActionCard href="/admin/offers" label="Bekleyen Teklifler" icon="💰" />
              <QuickActionCard href="/admin/reconciliation" label="Mutabakat" icon="📋" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function QuickActionCard({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-4 hover:border-brand-500 hover:shadow-sm transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
      <span className="ml-auto text-[var(--muted-foreground)]">→</span>
    </a>
  );
}
