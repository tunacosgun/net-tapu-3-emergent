'use client';

import Link from 'next/link';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { Phone, Mail, Instagram, Youtube, MessageCircle } from 'lucide-react';

const footerSections = [
  {
    title: 'Platform',
    links: [
      { href: '/parcels', label: 'Arsalar' },
      { href: '/auctions', label: 'Açık Artırmalar' },
      { href: '/parcels?view=map', label: 'Harita' },
      { href: '/how-it-works', label: 'Nasıl Çalışır?' },
    ],
  },
  {
    title: 'Kurumsal',
    links: [
      { href: '/about', label: 'Hakkımızda' },
      { href: '/vision', label: 'Vizyon' },
      { href: '/mission', label: 'Misyon' },
      { href: '/references', label: 'Referanslar' },
      { href: '/press', label: 'Basın' },
    ],
  },
  {
    title: 'Yasal',
    links: [
      { href: '/legal', label: 'Kullanım Koşulları' },
      { href: '/withdrawal-rights', label: 'Cayma Hakkı' },
      { href: '/legal', label: 'Gizlilik Politikası' },
      { href: '/legal', label: 'KVKK Aydınlatma' },
    ],
  },
  {
    title: 'Destek',
    links: [
      { href: '/faq', label: 'Sık Sorulan Sorular' },
      { href: '/real-estate-guide', label: 'Gayrimenkul Rehberi' },
      { href: '/post-sale', label: 'Satış Sonrası' },
      { href: '/contact', label: 'İletişim' },
    ],
  },
];

export function Footer() {
  const s = useSiteSettings();

  const phone = s.contact_phone || '0850 XXX XX XX';
  const email = s.contact_email || 'info@nettapu.com';
  const tagline = s.footer_tagline || 'Gayrimenkul ve arsa alım-satımı için Türkiye\'nin güvenilir online açık artırma platformu.';
  const copyright = s.copyright_text || `\u00A9 ${new Date().getFullYear()} NetTapu. Tüm hakları saklıdır.`;

  return (
    <footer className="border-t border-gray-200/80 bg-gray-50/50">
      <div className="mx-auto max-w-7xl px-4 py-16">
        {/* Main grid */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
              {s.site_logo ? (
                <img src={s.site_logo} alt={s.site_title || 'NetTapu'} className="h-8 w-auto" />
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-sm shadow-brand-500/20">
                    <span className="text-sm font-bold text-white">NT</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900 tracking-tight">{s.site_title || 'NetTapu'}</span>
                </>
              )}
            </Link>
            <p className="mt-4 text-sm text-gray-500 leading-relaxed">
              {tagline}
            </p>

            {/* Social */}
            <div className="mt-5 flex gap-2">
              {[
                { href: s.social_instagram || 'https://instagram.com/nettapu', icon: Instagram, label: 'Instagram' },
                { href: s.social_twitter || 'https://twitter.com/nettapu', icon: () => (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                ), label: 'X' },
                { href: s.social_youtube || 'https://youtube.com/@nettapu', icon: Youtube, label: 'YouTube' },
                ...(s.whatsapp_number ? [{ href: `https://wa.me/${s.whatsapp_number}`, icon: MessageCircle, label: 'WhatsApp' }] : []),
              ].map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200/80 text-gray-400 hover:text-brand-500 hover:border-brand-300 hover:bg-brand-50/50 transition-all duration-200 cursor-pointer"
                    aria-label={social.label}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link, idx) => (
                  <li key={`${link.href}-${idx}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-brand-600 transition-colors duration-150 cursor-pointer"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-gray-200/80 pt-8 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center gap-5 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {phone}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {email}
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">
              {copyright}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Eser Group iştirakidir.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
