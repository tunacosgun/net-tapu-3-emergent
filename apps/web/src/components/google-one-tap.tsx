'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export function GoogleOneTap() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const user = useAuthStore((s) => s.user);
  const initialized = useRef(false);

  useEffect(() => {
    // Don't show if already logged in or no client ID
    if (user || !clientId || initialized.current) return;

    function handleCredentialResponse(response: { credential: string }) {
      // Send credential to backend
      fetch('/api/v1/auth/google/one-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('One Tap auth failed');
          return res.json();
        })
        .then(async (data) => {
          // Set tokens in store
          useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);

          const storeUser = useAuthStore.getState().user;
          const role = storeUser?.roles?.includes('superadmin')
            ? 'superadmin'
            : storeUser?.roles?.includes('admin')
              ? 'admin'
              : 'user';

          // Persist session
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              role,
            }),
          });

          window.location.reload();
        })
        .catch(() => {
          // Silently fail — user can still use normal login
        });
    }

    function loadAndInit() {
      if (!window.google?.accounts?.id) return;
      initialized.current = true;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: true,
        cancel_on_tap_outside: true,
        itp_support: true,
        use_fedcm_for_prompt: true,
      });

      window.google.accounts.id.prompt();
    }

    // Load Google Identity Services script
    if (window.google?.accounts?.id) {
      loadAndInit();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = loadAndInit;
      document.head.appendChild(script);
    }

    return () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [user, clientId]);

  return null; // One Tap renders its own UI via Google's library
}
