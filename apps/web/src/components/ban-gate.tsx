'use client';

import { useBanStatus } from '@/hooks/use-ban-status';
import { BanScreen } from '@/components/ban-screen';
import { useAuthStore } from '@/stores/auth-store';

interface BanGateProps {
  feature: string;
  children: React.ReactNode;
}

export function BanGate({ feature, children }: BanGateProps) {
  const { isFeatureBanned, loading } = useBanStatus();
  const accessToken = useAuthStore((s) => s.accessToken);

  // Don't check if not logged in
  if (!accessToken) return <>{children}</>;

  // Don't block while loading
  if (loading) return <>{children}</>;

  const ban = isFeatureBanned(feature);
  if (!ban) return <>{children}</>;

  return (
    <BanScreen
      reason={ban.reason}
      restrictedFeatures={ban.restrictedFeatures}
      expiresAt={ban.expiresAt}
      feature={feature}
    />
  );
}
