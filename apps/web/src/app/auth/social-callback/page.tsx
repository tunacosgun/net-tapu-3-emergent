'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Suspense } from 'react';

function SocialCallbackContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const returnTo = searchParams.get('returnTo') || '/';

    if (!accessToken || !refreshToken) {
      setError('Giriş bilgileri alınamadı. Lütfen tekrar deneyin.');
      return;
    }

    // Store tokens and set session cookie
    (async () => {
      try {
        // Set auth store
        useAuthStore.getState().setTokens(accessToken, refreshToken);

        // Fetch user info
        const meRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/me`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        let role = 'user';
        if (meRes.ok) {
          const userData = await meRes.json();
          useAuthStore.getState().setUser(userData);
          role = userData.roles?.includes('superadmin')
            ? 'superadmin'
            : userData.roles?.includes('admin')
              ? 'admin'
              : 'user';
        }

        // Persist session in httpOnly cookies
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken, role }),
        });

        window.location.href = returnTo;
      } catch {
        setError('Giriş sırasında bir hata oluştu.');
      }
    })();
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <a href="/login" className="text-brand-500 hover:underline">
            Giriş sayfasına dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="mt-4 text-[var(--muted-foreground)]">Giriş yapılıyor...</p>
      </div>
    </div>
  );
}

export default function SocialCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      }
    >
      <SocialCallbackContent />
    </Suspense>
  );
}
