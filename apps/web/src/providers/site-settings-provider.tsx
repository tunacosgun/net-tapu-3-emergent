'use client';

import { useEffect, useState, type ReactNode } from 'react';
import apiClient from '@/lib/api-client';
import { SiteSettingsContext, type SiteSettings } from '@/hooks/use-site-settings';

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});

  useEffect(() => {
    apiClient
      .get<Record<string, string>>('/content/site-settings')
      .then(({ data }) => {
        setSettings(data || {});
        // Dynamically set favicon from admin settings
        if (data?.site_favicon) {
          let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.site_favicon;
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}
