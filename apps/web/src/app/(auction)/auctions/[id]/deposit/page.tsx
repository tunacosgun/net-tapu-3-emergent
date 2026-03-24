'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { Card, Alert, Button, LoadingState } from '@/components/ui';
import type { Auction, Payment, ApiError } from '@/types';
import { AxiosError } from 'axios';

type PaymentMethodType = 'credit_card' | 'bank_transfer';

interface BankInfo {
  bankName: string;
  iban: string;
  accountHolder: string;
  swiftCode?: string;
  branch?: string;
}

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('credit_card');
  const [bankInfo, setBankInfo] = useState<BankInfo>({
    bankName: '',
    iban: '',
    accountHolder: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [auctionRes, settingsRes] = await Promise.all([
          apiClient.get<Auction>(`/auctions/${auctionId}`),
          apiClient.get('/content/site-settings').catch(() => ({ data: {} })),
        ]);
        if (!cancelled) {
          setAuction(auctionRes.data);
          const s = settingsRes.data as Record<string, string>;
          setBankInfo({
            bankName: s.bank_name || 'Banka bilgisi girilmemiş',
            iban: s.bank_iban || '-',
            accountHolder: s.bank_account_holder || '-',
            swiftCode: s.bank_swift_code,
            branch: s.bank_branch,
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Bilgiler alınamadı.');
          setLoading(false);
        }
      }
    }
    fetchData();
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
        paymentMethod,
        idempotencyKey,
        description: `Depozito: ${auction.title}`,
      });

      if (data.status === 'awaiting_3ds' && data.threeDsRedirectUrl) {
        setThreeDsUrl(data.threeDsRedirectUrl);
      } else {
        setSuccess(true);
        setTimeout(() => router.push(`/auctions/${auctionId}?depositSuccess=1`), 2000);
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
        {/* Payment Method Selection */}
        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-3">Ödeme Yöntemi</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('credit_card')}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${paymentMethod === 'credit_card' ? 'border-brand-500 bg-brand-50' : 'border-[var(--border)] hover:border-gray-300'}`}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
              <span className="text-sm font-medium">Kredi Kartı</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">3D Secure ile güvenli</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('bank_transfer')}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${paymentMethod === 'bank_transfer' ? 'border-brand-500 bg-brand-50' : 'border-[var(--border)] hover:border-gray-300'}`}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>
              <span className="text-sm font-medium">Havale / EFT</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">Banka hesabına transfer</span>
            </button>
          </div>
        </div>

        {paymentMethod === 'credit_card' ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Depozito tutarı kredi kartınızdan tahsil edilecektir.
            Açık artırma sonuçlandığında kazanamazsanız depozito iade edilecektir.
          </p>
        ) : (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
            <p className="text-sm font-medium text-blue-800">Havale / EFT Bilgileri</p>
            <div className="text-xs text-blue-700 space-y-1">
              <p><span className="font-medium">Banka:</span> {bankInfo.bankName}</p>
              <p><span className="font-medium">IBAN:</span> {bankInfo.iban}</p>
              <p><span className="font-medium">Hesap Sahibi:</span> {bankInfo.accountHolder}</p>
              {bankInfo.branch && <p><span className="font-medium">Şube:</span> {bankInfo.branch}</p>}
              {bankInfo.swiftCode && <p><span className="font-medium">SWIFT:</span> {bankInfo.swiftCode}</p>}
              <p><span className="font-medium">Açıklama:</span> {auction?.title || 'Depozito'} - İhale No</p>
            </div>
            <p className="text-[10px] text-blue-600 mt-2">
              Havale yaptıktan sonra dekontunuzu WhatsApp veya e-posta ile iletmeniz gerekmektedir.
              Ödemeniz onaylandıktan sonra ihaleye katılabilirsiniz.
            </p>
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full py-3">
          {submitting
            ? 'İşleniyor...'
            : paymentMethod === 'credit_card'
              ? `${formatPrice(auction?.requiredDeposit ?? null)} Depozito Yatır`
              : 'Havale Bildirimini Gönder'}
        </Button>
      </form>
    </div>
  );
}
