'use client';

import Link from 'next/link';
import { useSiteSettings } from '@/hooks/use-site-settings';

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
      { href: '/about', label: 'İletişim' },
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
    <footer className="border-t border-[var(--border)] bg-[var(--muted)]">
      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Main footer grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              {s.site_logo ? (
                <img src={s.site_logo} alt={s.site_title || 'NetTapu'} className="h-8 w-auto" />
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
                    <span className="text-sm font-bold text-white">NT</span>
                  </div>
                  <span className="text-xl font-bold text-brand-500">{s.site_title || 'NetTapu'}</span>
                </>
              )}
            </Link>
            <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
              {tagline}
            </p>

            {/* Social Links */}
            <div className="mt-4 flex gap-3">
              {(s.social_instagram || 'https://instagram.com/nettapu') && (
                <a
                  href={s.social_instagram || 'https://instagram.com/nettapu'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:text-brand-500 hover:border-brand-500 transition-colors"
                  aria-label="Instagram"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>
              )}
              {(s.social_twitter || 'https://twitter.com/nettapu') && (
                <a
                  href={s.social_twitter || 'https://twitter.com/nettapu'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:text-brand-500 hover:border-brand-500 transition-colors"
                  aria-label="X (Twitter)"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              )}
              {(s.social_youtube || 'https://youtube.com/@nettapu') && (
                <a
                  href={s.social_youtube || 'https://youtube.com/@nettapu'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:text-brand-500 hover:border-brand-500 transition-colors"
                  aria-label="YouTube"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              )}
              {s.whatsapp_number && (
                <a
                  href={`https://wa.me/${s.whatsapp_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:text-green-500 hover:border-green-500 transition-colors"
                  aria-label="WhatsApp"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="mt-3 space-y-2">
                {section.links.map((link, idx) => (
                  <li key={`${link.href}-${idx}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--muted-foreground)] hover:text-brand-500 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact info */}
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-[var(--border)] pt-8 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {phone}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              {email}
            </span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
