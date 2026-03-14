'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
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
  const { isAuthenticated, user, avatarUrl } = useAuthStore();
  const s = useSiteSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 0); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('superadmin');

  return (
    <header className={`sticky top-0 z-50 bg-white border-b transition-shadow duration-200 ${scrolled ? 'shadow-sm border-gray-200' : 'border-gray-100'}`}>
      {/* Top bar */}
      <div className="hidden sm:block border-b border-gray-100 bg-gray-50">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            {s.contact_phone && (
              <a href={`tel:${s.contact_phone}`} className="flex items-center gap-1 hover:text-gray-700">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                {s.contact_phone}
              </a>
            )}
            {s.contact_email && (
              <a href={`mailto:${s.contact_email}`} className="flex items-center gap-1 hover:text-gray-700">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                {s.contact_email}
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/contact" className="hover:text-gray-700">İletişim</Link>
            <span className="text-gray-300">|</span>
            <Link href="/how-it-works" className="hover:text-gray-700">Yardım</Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          {s.site_logo ? (
            <img src={s.site_logo} alt={s.site_title || 'NetTapu'} className="h-9 w-auto" />
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white text-sm font-extrabold">
                NT
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-bold text-gray-900">{s.site_title || 'NetTapu'}</span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider -mt-0.5">Arsa & Açık Artırma</span>
              </div>
            </>
          )}
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {mainNav.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Link
            href="/parcels?view=map"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-brand-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            Harita
          </Link>

          {isAuthenticated ? (
            <>
              <Link href="/profile/favorites" className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-red-500 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                <span className="hidden lg:inline">Favoriler</span>
              </Link>

              {isAdmin && (
                <Link href="/admin" className="flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                </Link>
              )}

              {/* Profile */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white overflow-hidden"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    user?.email?.charAt(0).toUpperCase() || 'U'
                  )}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Kişisel Hesap</p>
                    </div>
                    <div className="py-1">
                      <Link href="/profile" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Hesabım
                      </Link>
                      <Link href="/profile/favorites" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Favorilerim
                      </Link>
                    </div>
                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={async () => {
                          setProfileOpen(false);
                          try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch {}
                          useAuthStore.getState().clearTokens();
                          window.location.href = '/login';
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Çıkış Yap
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Giriş Yap
              </Link>
              <Link href="/register" className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
                Üye Ol
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? (
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <nav className="px-4 py-3 space-y-1">
            {mainNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 text-sm font-medium rounded-md ${
                    isActive ? 'text-brand-600 bg-brand-50' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="border-t border-gray-100 pt-2 mt-2">
              <Link href="/parcels?view=map" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md">
                Harita
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md">
                    Hesabım
                  </Link>
                  <button
                    onClick={async () => {
                      setMobileOpen(false);
                      try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch {}
                      useAuthStore.getState().clearTokens();
                      window.location.href = '/login';
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-md"
                  >
                    Çıkış Yap
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
