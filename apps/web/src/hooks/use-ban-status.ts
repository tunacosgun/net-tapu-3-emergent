'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';

interface BanInfo {
  reason: string;
  restrictedFeatures: string[];
  expiresAt: string | null;
}

interface BanStatus {
  banned: boolean;
  bans: BanInfo[];
}

export function useBanStatus() {
  const [status, setStatus] = useState<BanStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiClient.get<BanStatus>('/auth/ban-status');
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isFeatureBanned = useCallback(
    (feature: string): BanInfo | null => {
      if (!status?.banned) return null;
      for (const ban of status.bans) {
        if (ban.restrictedFeatures.includes('full') || ban.restrictedFeatures.includes(feature)) {
          return ban;
        }
      }
      return null;
    },
    [status],
  );

  return { status, loading, isFeatureBanned, refresh };
}
