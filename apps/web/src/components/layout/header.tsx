'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteSettings } from '@/hooks/use-site-settings';

const mainNav = [
  { href: '/parcels', label: 'Arsalar', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z' },
  { href: '/auctions', label: 'Açık Artırmalar', icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z' },
  { href: '/how-it-works', label: 'Nasıl Çalışır?', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
  { href: '/about', label: 'Hakkımızda', icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z' },
];

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, user, avatarUrl } = useAuthStore();
  const s = useSiteSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
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

  // Track scroll for header shadow
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isAdmin =
    user?.roles?.includes('admin') || user?.roles?.includes('superadmin');

  const announcement = s.header_announcement;

  return (
    <>
      {/* Announcement Bar */}
      {announcement && !announcementDismissed && (
        <div className="relative z-50 bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-500 text-white print:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <svg className="h-4 w-4 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <span>{announcement}</span>
              <Link href="/parcels" className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold hover:bg-white/30 transition-all duration-200 hover:gap-2">
                İncele
                <svg className="h-3 w-3 transition-transform duration-200" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
            <button
              onClick={() => setAnnouncementDismissed(true)}
              className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/20 hover:rotate-90 transition-all duration-300"
              aria-label="Kapat"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-50 bg-white/95 backdrop-blur-xl transition-all duration-300 ${
        scrolled ? 'shadow-lg shadow-black/[0.03] border-b border-gray-100' : 'border-b border-transparent'
      }`}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            {s.site_logo ? (
              <img src={s.site_logo} alt={s.site_title || 'NetTapu'} className="h-10 w-auto" />
            ) : (
              <>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/25 group-hover:shadow-xl group-hover:shadow-brand-500/30 group-hover:scale-105 transition-all duration-300">
                  <span className="text-base font-extrabold text-white tracking-tight">NT</span>
                  <div className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent group-hover:from-brand-600 group-hover:to-brand-500 transition-all duration-300">{s.site_title || 'NetTapu'}</span>
                  <span className="text-[9px] font-semibold text-gray-400 tracking-[0.2em] uppercase -mt-0.5">Arsa & Açık Artırma</span>
                </div>
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
                  className={`nav-link-hover group relative rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all duration-300 ${
                    isActive
                      ? 'active text-brand-600'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    {item.label}
                  </span>
                  {/* Hover background pill */}
                  <span className="absolute inset-0 rounded-lg bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-0" />
                  {isActive && (
                    <span className="absolute inset-0 rounded-lg bg-brand-50 -z-0" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* Map Link */}
            <Link
              href="/parcels?view=map"
              className="icon-hover-bounce hidden items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-all duration-300 sm:flex"
              title="Harita"
            >
              <svg className="h-[18px] w-[18px] transition-transform duration-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
              <span className="hidden lg:inline">Harita</span>
            </Link>

            {isAuthenticated ? (
              <>
                {/* Favorites */}
                <Link
                  href="/profile/favorites"
                  className="group flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-red-500 transition-all duration-300"
                  title="Favorilerim"
                >
                  <svg className="h-[18px] w-[18px] transition-all duration-300 group-hover:scale-110 group-hover:fill-red-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  <span className="hidden lg:inline">Favoriler</span>
                </Link>

                {/* Admin */}
                {isAdmin && (
                  <Link href="/admin" className="group flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-300 hover:shadow-md hover:shadow-amber-100 transition-all duration-300">
                    <svg className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin
                  </Link>
                )}

                {/* Profile Avatar */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="avatar-hover relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white ring-2 ring-white shadow-md overflow-hidden"
                    title="Hesabım"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      user?.email?.charAt(0).toUpperCase() || 'U'
                    )}
                  </button>
                  {/* Online indicator */}
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-white animate-glow-pulse" />

                  {profileOpen && (
                    <div className="animate-fadeInDown absolute right-0 top-full mt-3 w-72 rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/10 z-50 overflow-hidden">
                      {/* Profile header */}
                      <div className="bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white backdrop-blur-sm ring-2 ring-white/30 overflow-hidden">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                            ) : (
                              user?.email?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                            <p className="text-[11px] text-white/70 font-medium">Kişisel Hesap</p>
                          </div>
                        </div>
                      </div>
                      {/* Menu items */}
                      <div className="py-2 stagger-children">
                        <Link
                          href="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="group flex items-center gap-3 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600 transition-all duration-200"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-500 transition-all duration-200">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold">Hesabım</p>
                            <p className="text-[11px] text-gray-400 group-hover:text-brand-400">Profil bilgilerinizi yönetin</p>
                          </div>
                          <svg className="ml-auto h-4 w-4 text-gray-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </Link>
                        <Link
                          href="/profile/favorites"
                          onClick={() => setProfileOpen(false)}
                          className="group flex items-center gap-3 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-red-500 transition-all duration-200"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400 group-hover:bg-red-50 group-hover:text-red-400 transition-all duration-200">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold">Favorilerim</p>
                            <p className="text-[11px] text-gray-400 group-hover:text-red-300">Kayıtlı arsalarınız</p>
                          </div>
                          <svg className="ml-auto h-4 w-4 text-gray-300 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </Link>
                      </div>
                      {/* Logout */}
                      <div className="border-t border-gray-100 p-2">
                        <button
                          onClick={async () => {
                            setProfileOpen(false);
                            try {
                              await fetch('/api/auth/session', { method: 'DELETE' });
                            } catch {}
                            useAuthStore.getState().clearTokens();
                            window.location.href = '/login';
                          }}
                          className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400 group-hover:bg-red-100 group-hover:text-red-500 transition-all duration-200">
                            <svg className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                          </div>
                          Çıkış Yap
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="group rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-all duration-300 relative">
                  Giriş Yap
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-brand-500 rounded-full group-hover:w-1/2 transition-all duration-300" />
                </Link>
                <Link href="/register" className="btn-shine rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                  Ücretsiz Üye Ol
                </Link>
              </div>
            )}

            <button
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 md:hidden transition-all duration-200"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              <div className="relative h-5 w-5">
                <span className={`absolute left-0 top-0.5 h-0.5 w-5 bg-gray-600 rounded-full transition-all duration-300 ${mobileOpen ? 'rotate-45 top-2' : ''}`} />
                <span className={`absolute left-0 top-[9px] h-0.5 w-5 bg-gray-600 rounded-full transition-all duration-200 ${mobileOpen ? 'opacity-0 translate-x-2' : ''}`} />
                <span className={`absolute left-0 bottom-0.5 h-0.5 w-5 bg-gray-600 rounded-full transition-all duration-300 ${mobileOpen ? '-rotate-45 bottom-[7px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="border-t border-gray-100 px-4 pb-5 bg-white">
            <nav className="flex flex-col gap-1 pt-3 stagger-children">
              {mainNav.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? 'text-brand-600 bg-brand-50'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${
                      isActive ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                    </div>
                    {item.label}
                  </Link>
                );
              })}
              {isAuthenticated && (
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    Hesabım
                  </Link>
                  <button
                    onClick={async () => {
                      setMobileOpen(false);
                      try {
                        await fetch('/api/auth/session', { method: 'DELETE' });
                      } catch {}
                      useAuthStore.getState().clearTokens();
                      window.location.href = '/login';
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                    </div>
                    Çıkış Yap
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
