'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { Card, Badge, Alert, EmptyState, LoadingState, Button } from '@/components/ui';
import { showApiError } from '@/components/api-error-toast';
import type { Offer } from '@/types';

const offerStatusMap: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; label: string; icon: string }> = {
  pending: { variant: 'warning', label: 'Değerlendiriliyor', icon: '⏳' },
  accepted: { variant: 'success', label: 'Kabul Edildi', icon: '✅' },
  rejected: { variant: 'danger', label: 'Reddedildi', icon: '❌' },
  countered: { variant: 'info', label: 'Karşı Teklif', icon: '🔄' },
  expired: { variant: 'default', label: 'Süresi Doldu', icon: '⏰' },
  withdrawn: { variant: 'default', label: 'Geri Çekildi', icon: '↩️' },
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Offer[]>('/crm/offers/mine')
      .then(({ data }) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setError('Teklifler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleWithdraw(offerId: string) {
    try {
      await apiClient.post(`/crm/offers/${offerId}/withdraw`);
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, status: 'withdrawn' } : o)),
      );
    } catch (err) {
      showApiError(err);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <Alert>{error}</Alert>;

  // Summary stats
  const pending = offers.filter((o) => o.status === 'pending').length;
  const accepted = offers.filter((o) => o.status === 'accepted').length;
  const total = offers.length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Tekliflerim</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Arsalar için verdiğiniz teklifler
          </p>
        </div>
        <Link href="/parcels">
          <Button size="sm">Arsa Keşfet</Button>
        </Link>
      </div>

      {/* Summary cards */}
      {offers.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4 text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Toplam Teklif</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pending}</p>
            <p className="text-xs text-amber-600/70">Beklemede</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{accepted}</p>
            <p className="text-xs text-green-600/70">Kabul Edilen</p>
          </div>
        </div>
      )}

      {offers.length === 0 ? (
        <div className="mt-12">
          <EmptyState message="Henüz teklif vermediniz." />
          <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
            Beğendiğiniz bir arsa için teklif vererek başlayabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {offers.map((offer) => {
            const st = offerStatusMap[offer.status] || { variant: 'default' as const, label: offer.status, icon: '📋' };
            return (
              <Card key={offer.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{st.icon}</span>
                      <Link
                        href={`/parcels/${offer.parcelId}`}
                        className="font-semibold hover:text-brand-500 transition-colors"
                      >
                        Arsa #{offer.parcelId.slice(0, 8).toUpperCase()}
                      </Link>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-brand-500">
                      {formatPrice(offer.amount)}
                    </p>
                    {offer.message && (
                      <p className="mt-2 text-sm text-[var(--muted-foreground)] italic border-l-2 border-[var(--border)] pl-3">
                        &ldquo;{offer.message}&rdquo;
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]">
                      <span>📅 {formatDate(offer.createdAt, 'datetime')}</span>
                      {offer.expiresAt && (
                        <span>⏰ Bitiş: {formatDate(offer.expiresAt, 'date')}</span>
                      )}
                    </div>
                  </div>
                  {offer.status === 'pending' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleWithdraw(offer.id)}
                    >
                      Geri Çek
                    </Button>
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
