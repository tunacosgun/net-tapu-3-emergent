'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Hook to track real-time viewers for a parcel.
 * Registers the viewer on mount, sends heartbeats, and removes on unmount.
 */
export function useViewerTracking(parcelId: string | undefined) {
  const [viewerCount, setViewerCount] = useState(0);
  const sessionIdRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const register = useCallback(async (id: string, sid: string) => {
    try {
      const { data } = await apiClient.post<{ viewerCount: number }>(
        `/parcels/${id}/viewers`,
        { sessionId: sid },
      );
      setViewerCount(data.viewerCount);
    } catch {
      // Non-critical — silently fail
    }
  }, []);

  const heartbeat = useCallback(async (id: string, sid: string) => {
    try {
      const { data } = await apiClient.post<{ viewerCount: number }>(
        `/parcels/${id}/viewers/heartbeat`,
        { sessionId: sid },
      );
      setViewerCount(data.viewerCount);
    } catch {
      // Non-critical
    }
  }, []);

  const remove = useCallback(async (id: string, sid: string) => {
    try {
      await apiClient.delete(`/parcels/${id}/viewers`, {
        data: { sessionId: sid },
      });
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (!parcelId) return;

    const sid = generateSessionId();
    sessionIdRef.current = sid;

    // Register viewer
    register(parcelId, sid);

    // Start heartbeat
    intervalRef.current = setInterval(() => {
      heartbeat(parcelId, sid);
    }, HEARTBEAT_INTERVAL);

    // Cleanup on unmount or parcelId change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      remove(parcelId, sid);
    };
  }, [parcelId, register, heartbeat, remove]);

  return viewerCount;
}
