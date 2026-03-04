'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import type { Payment } from '@/types';

type ResultState = 'loading' | 'success' | 'failure';

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="text-lg font-semibold">Yükleniyor...</p>
          </div>
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ResultState>('loading');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const polled = useRef(false);

  useEffect(() => {
    if (polled.current) return;
    polled.current = true;

    // Providers may send: paymentId, payment_id, token, merchant_oid, etc.
    const paymentId =
      searchParams.get('paymentId') ||
      searchParams.get('payment_id') ||
      searchParams.get('merchant_oid') ||
      searchParams.get('token');

    const providerStatus =
      searchParams.get('status') ||
      searchParams.get('mdStatus') ||
      searchParams.get('result');

    // Quick failure detection from provider params
    if (providerStatus === 'failure' || providerStatus === 'failed' || providerStatus === '0') {
      setState('failure');
      setErrorMsg(
        searchParams.get('err_msg') ||
        searchParams.get('error_message') ||
        'Ödeme sağlayıcıdan başarısız yanıt alındı.',
      );
      return;
    }

    if (!paymentId) {
      setState('failure');
      setErrorMsg('Ödeme bilgisi bulunamadı.');
      return;
    }

    // Poll backend for confirmed status
    let attempts = 0;
    const maxAttempts = 10;
    const interval = 2000;

    async function poll() {
      try {
        const { data } = await apiClient.get<Payment>(`/payments/${paymentId}`);
        setPayment(data);

        if (data.status === 'provisioned' || data.status === 'completed') {
          setState('success');
          return;
        }

        if (data.status === 'failed' || data.status === 'cancelled') {
          setState('failure');
          setErrorMsg('Ödeme başarısız oldu.');
          return;
        }

        // Still pending/awaiting — retry
        attempts++;
        if (attempts >= maxAttempts) {
          setState('failure');
          setErrorMsg('Ödeme durumu belirlenemedi. Lütfen daha sonra kontrol edin.');
          return;
        }

        setTimeout(poll, interval);
      } catch {
        attempts++;
        if (attempts >= maxAttempts) {
          setState('failure');
          setErrorMsg('Ödeme durumu sorgulanamadı.');
          return;
        }
        setTimeout(poll, interval);
      }
    }

    poll();
  }, [searchParams]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="text-lg font-semibold">Ödeme Doğrulanıyor...</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            3D Secure doğrulaması tamamlandı. Ödeme durumu kontrol ediliyor.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-green-700">Ödeme Başarılı</h1>
          {payment && (
            <p className="text-sm text-[var(--muted-foreground)]">
              {new Intl.NumberFormat('tr-TR', {
                style: 'currency',
                currency: payment.currency || 'TRY',
                minimumFractionDigits: 0,
              }).format(parseFloat(payment.amount))}{' '}
              tutarında ödemeniz onaylandı.
            </p>
          )}
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/"
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
            >
              Ana Sayfa
            </Link>
            <Link
              href="/auctions"
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              Açık Artırmalara Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // failure
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-red-700">Ödeme Başarısız</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {errorMsg}
        </p>
        {payment && (
          <p className="text-xs text-[var(--muted-foreground)]">
            İşlem No: {payment.id}
          </p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/"
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
          >
            Ana Sayfa
          </Link>
          <Link
            href="/auctions"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            Tekrar Dene
          </Link>
        </div>
      </div>
    </div>
  );
}
