'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { Card, Alert, Button, LoadingState } from '@/components/ui';
import type { Auction, Payment, ApiError } from '@/types';
import { AxiosError } from 'axios';

export default function DepositPage() {
  const params = useParams<{ id: string }>();
  const auctionId = params.id;
  const router = useRouter();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [threeDsUrl, setThreeDsUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAuction() {
      try {
        const { data } = await apiClient.get<Auction>(`/auctions/${auctionId}`);
        if (!cancelled) {
          setAuction(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Açık artırma bilgisi alınamadı.');
          setLoading(false);
        }
      }
    }
    fetchAuction();
    return () => { cancelled = true; };
  }, [auctionId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auction) return;
    setError(null);
    setSubmitting(true);

    try {
      const idempotencyKey = crypto.randomUUID();
      const { data } = await apiClient.post<Payment>('/payments', {
        parcelId: auction.parcelId,
        auctionId,
        amount: auction.requiredDeposit,
        currency: auction.currency || 'TRY',
        paymentMethod: 'credit_card',
        idempotencyKey,
        description: `Depozito: ${auction.title}`,
      });

      if (data.status === 'awaiting_3ds' && data.threeDsRedirectUrl) {
        setThreeDsUrl(data.threeDsRedirectUrl);
      } else {
        setSuccess(true);
        setTimeout(() => router.push(`/auctions/${auctionId}`), 2000);
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        const apiErr = err.response?.data as ApiError | undefined;
        const msg = apiErr?.message;
        setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Ödeme başarısız.');
      } else {
        setError('Ödeme başarısız.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingState centered={false} />
      </div>
    );
  }

  if (threeDsUrl) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-bold">3D Secure Doğrulama</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Ödemenizi tamamlamak için bankanızın 3D Secure sayfasına yönlendiriliyorsunuz.
        </p>
        <iframe
          src={threeDsUrl}
          className="h-[500px] w-full rounded-lg border border-[var(--border)]"
          title="3D Secure"
        />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <div className="rounded-lg border-2 border-brand-500 p-8 text-center">
          <p className="text-lg font-bold text-brand-500">Depozito Yatırıldı</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Açık artırma sayfasına yönlendiriliyorsunuz...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Depozito Yatır</h1>

      {auction && (
        <Card className="space-y-2">
          <p className="font-semibold">{auction.title}</p>
          <div className="flex justify-between text-sm text-[var(--muted-foreground)]">
            <span>Gerekli Depozito</span>
            <span className="font-mono font-semibold text-[var(--foreground)]">
              {formatPrice(auction.requiredDeposit)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-[var(--muted-foreground)]">
            <span>Başlangıç Fiyatı</span>
            <span className="font-mono">{formatPrice(auction.startingPrice)}</span>
          </div>
        </Card>
      )}

      {error && <Alert>{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          Depozito tutarı kredi kartınızdan tahsil edilecektir.
          Açık artırma sonuçlandığında kazanamazsanız depozito iade edilecektir.
        </p>

        <Button type="submit" disabled={submitting} className="w-full py-3">
          {submitting
            ? 'İşleniyor...'
            : `${formatPrice(auction?.requiredDeposit ?? null)} Depozito Yatır`}
        </Button>
      </form>
    </div>
  );
}
