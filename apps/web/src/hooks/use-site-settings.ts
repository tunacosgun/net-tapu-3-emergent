'use client';

import { createContext, useContext } from 'react';

export interface SiteSettings {
  site_logo?: string;
  site_favicon?: string;
  watermark_logo?: string;
  site_title?: string;
  site_description?: string;
  contact_phone?: string;
  contact_email?: string;
  whatsapp_number?: string;
  address?: string;
  social_facebook?: string;
  social_twitter?: string;
  social_instagram?: string;
  social_linkedin?: string;
  social_youtube?: string;
  copyright_text?: string;
  footer_tagline?: string;
  header_announcement?: string;
  [key: string]: string | undefined;
}

export const SiteSettingsContext = createContext<SiteSettings>({});

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext);
}
