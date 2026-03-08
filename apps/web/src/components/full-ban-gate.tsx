'use client';

import { usePathname } from 'next/navigation';
import { useBanStatus } from '@/hooks/use-ban-status';
import { BanScreen } from '@/components/ban-screen';
import { useAuthStore } from '@/stores/auth-store';

const EXCLUDED_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/admin'];

export function FullBanGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isFeatureBanned, loading } = useBanStatus();
  const accessToken = useAuthStore((s) => s.accessToken);

  // Don't check on excluded pages (auth + admin)
  if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) return <>{children}</>;

  // Don't check if not logged in or still loading
  if (!accessToken || loading) return <>{children}</>;

  const ban = isFeatureBanned('full');
  if (!ban) return <>{children}</>;

  return (
    <BanScreen
      reason={ban.reason}
      restrictedFeatures={ban.restrictedFeatures}
      expiresAt={ban.expiresAt}
      feature="full"
    />
  );
}
