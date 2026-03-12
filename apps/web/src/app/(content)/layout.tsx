'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navLinks = [
  { href: '/about', label: 'Hakkımızda', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/vision', label: 'Vizyon', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  { href: '/mission', label: 'Misyon', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { href: '/how-it-works', label: 'Nasıl Çalışırız', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { href: '/faq', label: 'S.S.S.', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/references', label: 'Referanslar', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { href: '/press', label: 'Basın', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { href: '/legal', label: 'Yasal Bilgiler', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/withdrawal-rights', label: 'Cayma Hakkı', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
  { href: '/real-estate-guide', label: 'Gayrimenkul Rehberi', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { href: '/contact', label: 'İletişim', icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
];

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentLink = navLinks.find((l) => pathname === l.href || pathname.startsWith(l.href + '/'));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Link href="/" className="hover:text-brand-500 transition-colors">Ana Sayfa</Link>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)] font-medium">{currentLink?.label || 'Kurumsal'}</span>
      </nav>

      {/* Mobile nav toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-medium shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            {currentLink && (
              <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={currentLink.icon} />
              </svg>
            )}
            <span>{currentLink?.label || 'Kurumsal Sayfalar'}</span>
          </div>
          <svg className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {mobileOpen && (
          <div className="mt-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-lg animate-in slide-in-from-top-2 duration-200">
            <nav className="divide-y divide-[var(--border)]">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                    }`}
                  >
                    <svg className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                    </svg>
                    <span>{link.label}</span>
                    {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <div className="lg:flex lg:gap-10">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:w-60 lg:shrink-0">
          <div className="sticky top-24">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3 px-3">Kurumsal</h2>
            <nav className="flex flex-col gap-0.5">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                      isActive ? 'bg-brand-50 text-brand-700 font-medium shadow-sm' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <svg className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                    </svg>
                    <span>{link.label}</span>
                    {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100/50 p-4 border border-brand-100">
              <p className="text-sm font-medium text-brand-800">Sorularınız mı var?</p>
              <p className="mt-1 text-xs text-brand-600">Uzman ekibimize ulaşın.</p>
              <Link href="/contact" className="mt-3 inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors">
                Bize Ulaşın
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 max-w-4xl">{children}</main>
      </div>
    </div>
  );
}
