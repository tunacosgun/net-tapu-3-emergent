'use client';

import Link from 'next/link';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { Phone, Mail, Instagram, Youtube, MessageCircle, MapPin, Clock } from 'lucide-react';

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
  const copyright = s.copyright_text || `© ${new Date().getFullYear()} NetTapu. Tüm hakları saklıdır.`;

  return (
    <footer className="bg-white" data-testid="main-footer">
      {/* Main footer content */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-6">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 group" data-testid="footer-logo">
              {s.site_logo ? (
                <img src={s.site_logo} alt={s.site_title || 'NetTapu'} className="h-10 w-auto" />
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-emerald transition-transform duration-200 group-hover:scale-105">
                    <span className="text-sm font-bold text-white">NT</span>
                  </div>
                  <span className="text-xl font-bold font-heading text-slate-900 tracking-tight">
                    {s.site_title || 'NetTapu'}
                  </span>
                </>
              )}
            </Link>
            
            <p className="mt-5 text-sm text-slate-500 leading-relaxed max-w-sm">
              {tagline}
            </p>

            {/* Contact info */}
            <div className="mt-6 space-y-3">
              <a 
                href={`tel:${phone}`} 
                className="flex items-center gap-3 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <span className="font-medium">{phone}</span>
              </a>
              <a 
                href={`mailto:${email}`} 
                className="flex items-center gap-3 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <span className="font-medium">{email}</span>
              </a>
            </div>

            {/* Social icons */}
            <div className="mt-6 flex gap-2">
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
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200"
                    aria-label={social.label}
                    data-testid={`footer-social-${social.label.toLowerCase()}`}
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
              <h3 className="text-sm font-bold font-heading text-slate-900 uppercase tracking-wider">
                {section.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {section.links.map((link, idx) => (
                  <li key={`${link.href}-${idx}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-emerald-600 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-slate-500">
              {copyright}
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <span>Eser Group iştirakidir.</span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                7/24 Destek
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
