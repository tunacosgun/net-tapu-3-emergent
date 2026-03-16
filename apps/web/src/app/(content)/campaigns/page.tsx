'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  type: 'discount' | 'installment' | 'special_pricing' | 'gamification';
  status: 'draft' | 'active' | 'paused' | 'ended';
  startDate: string;
  endDate: string;
  config: Record<string, unknown>;
}

const typeLabels: Record<string, { label: string; color: string; icon: string }> = {
  discount: { label: 'İndirim', color: 'bg-red-50 text-red-600 border-red-200', icon: '🏷️' },
  installment: { label: 'Taksitli Satış', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: '💳' },
  special_pricing: { label: 'Özel Fiyat', color: 'bg-purple-50 text-purple-600 border-purple-200', icon: '⭐' },
  gamification: { label: 'Çark', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: '🎡' },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to fetch public campaigns (active only)
    apiClient.get<{ data: Campaign[] }>('/admin/campaigns', { params: { status: 'active' } })
      .then(({ data }) => setCampaigns(data.data || []))
      .catch(() => {
        // If not authorized, show empty state
        setCampaigns([]);
      })
      .finally(() => setLoading(false));
  }, []);

  function daysLeft(endDate: string): number {
    return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  return (
    <main className="bg-white min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-600 to-brand-700">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center">
          <h1 className="text-3xl font-bold text-white">Kampanyalar & Fırsatlar</h1>
          <p className="mt-2 text-brand-100">Özel indirimler, taksitli satış seçenekleri ve kazandıran fırsatlar</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Spin Wheel CTA */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="text-5xl">🎡</div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-amber-800">Kazandıran Çark</h2>
            <p className="mt-1 text-sm text-amber-700">Günlük şansınızı deneyin! Çarkı çevirin, indirim kuponu kazanın.</p>
          </div>
          <Link href="/campaigns/spin" className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition-colors shadow-sm whitespace-nowrap">
            Çarkı Çevir
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : campaigns.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {campaigns.map((campaign) => {
              const typeInfo = typeLabels[campaign.type] || typeLabels.discount;
              const remaining = daysLeft(campaign.endDate);
              return (
                <div key={campaign.id} className="rounded-xl border border-[var(--border)] p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    {remaining <= 7 && remaining > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">
                        Son {remaining} gün!
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">{campaign.name}</h3>
                  {campaign.description && (
                    <p className="mt-2 text-sm text-[var(--muted-foreground)] line-clamp-2">{campaign.description}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>
                      {new Date(campaign.startDate).toLocaleDateString('tr-TR')} - {new Date(campaign.endDate).toLocaleDateString('tr-TR')}
                    </span>
                    <Link href="/parcels" className="text-brand-600 font-medium hover:underline">
                      İlanları Gör →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] p-12 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Aktif Kampanya Yok</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Şu anda aktif kampanya bulunmuyor. Yeni kampanyalar için bizi takip edin!
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/campaigns/spin" className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors">
                Çarkı Çevir
              </Link>
              <Link href="/parcels" className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                Arsaları İncele
              </Link>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] p-5">
            <div className="text-2xl mb-2">💳</div>
            <h3 className="font-semibold text-sm">Taksitli Ödeme</h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Uygun taksit seçenekleriyle arsa sahibi olun.</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-5">
            <div className="text-2xl mb-2">🏷️</div>
            <h3 className="font-semibold text-sm">Dönemsel İndirimler</h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Belirli dönemlerde özel fiyat avantajları.</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-5">
            <div className="text-2xl mb-2">🎁</div>
            <h3 className="font-semibold text-sm">Paylaş & Kazan</h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Arkadaşlarınıza önerip avantaj kazanın.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
