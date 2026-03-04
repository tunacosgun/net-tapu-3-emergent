'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { formatPrice, formatDate } from '@/lib/format';
import { Card, Badge, Alert, EmptyState, LoadingState, Button } from '@/components/ui';
import { showApiError } from '@/components/api-error-toast';
import type { Offer } from '@/types';

const offerStatusMap: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; label: string }> = {
  pending: { variant: 'warning', label: 'Değerlendiriliyor' },
  accepted: { variant: 'success', label: 'Kabul Edildi' },
  rejected: { variant: 'danger', label: 'Reddedildi' },
  countered: { variant: 'info', label: 'Karşı Teklif' },
  expired: { variant: 'default', label: 'Süresi Doldu' },
  withdrawn: { variant: 'default', label: 'Geri Çekildi' },
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Offer[]>('/offers', { params: { mine: true } })
      .then(({ data }) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setError('Teklifler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleWithdraw(offerId: string) {
    try {
      await apiClient.patch(`/offers/${offerId}`, { status: 'withdrawn' });
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, status: 'withdrawn' } : o)),
      );
    } catch (err) {
      showApiError(err);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <Alert>{error}</Alert>;

  return (
    <div>
      <h2 className="text-lg font-semibold">Tekliflerim</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Arsalar için verdiğiniz teklifler
      </p>

      {offers.length === 0 ? (
        <EmptyState message="Henüz teklif vermediniz." />
      ) : (
        <div className="mt-6 space-y-3">
          {offers.map((offer) => {
            const st = offerStatusMap[offer.status] || { variant: 'default' as const, label: offer.status };
            return (
              <Card key={offer.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/parcels/${offer.parcelId}`}
                        className="font-medium hover:text-brand-500"
                      >
                        İlan: {offer.parcelId.slice(0, 8)}...
                      </Link>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <p className="mt-1 text-lg font-bold text-brand-500">
                      {formatPrice(offer.amount)}
                    </p>
                    {offer.message && (
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {offer.message}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {formatDate(offer.createdAt, 'datetime')}
                      {offer.expiresAt && ` • Bitiş: ${formatDate(offer.expiresAt, 'date')}`}
                    </p>
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
