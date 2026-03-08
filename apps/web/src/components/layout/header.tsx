'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteSettings } from '@/hooks/use-site-settings';

const mainNav = [
  { href: '/parcels', label: 'Arsalar' },
  { href: '/auctions', label: 'Açık Artırmalar' },
  { href: '/how-it-works', label: 'Nasıl Çalışır?' },
  { href: '/about', label: 'Hakkımızda' },
];

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const s = useSiteSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  const isAdmin =
    user?.roles?.includes('admin') || user?.roles?.includes('superadmin');

  const announcement = s.header_announcement;

  return (
    <>
      {/* Announcement Bar */}
      {announcement && !announcementDismissed && (
        <div className="relative z-50 bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-500 text-white print:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <svg className="h-4 w-4 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <span>{announcement}</span>
              <Link href="/parcels" className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold hover:bg-white/30 transition-colors">
                İncele
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
            <button
              onClick={() => setAnnouncementDismissed(true)}
              className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              aria-label="Kapat"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          {/* Logo */}
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

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {mainNav.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-brand-600 bg-brand-50'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* Map Link */}
            <Link
              href="/parcels?view=map"
              className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors sm:flex"
              title="Harita"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
              <span className="hidden lg:inline">Harita</span>
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  href="/profile/favorites"
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                  title="Favorilerim"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  <span className="hidden lg:inline">Favoriler</span>
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                    Admin
                  </Link>
                )}
                <Link
                  href="/profile"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 hover:bg-brand-200 transition-colors"
                  title="Hesabim"
                >
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                  Giriş Yap
                </Link>
                <Link href="/register" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
                  Üye Ol
                </Link>
              </div>
            )}

            <button
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-md hover:bg-[var(--muted)] md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-[var(--border)] px-4 pb-4 md:hidden">
            <nav className="flex flex-col gap-1 pt-3">
              {mainNav.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-brand-600 bg-brand-50'
                        : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
