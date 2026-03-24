'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteSettings } from '@/hooks/use-site-settings';
import {
  Map, Heart, Shield, User, LogOut, Menu, X,
  ChevronDown, Phone, Mail, HelpCircle,
} from 'lucide-react';

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
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
          : 'bg-white border-b border-transparent'
      }`}
    >
      {/* Top utility bar */}
      <div className="hidden sm:block border-b border-gray-100/80">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            {s.contact_phone && (
              <a href={`tel:${s.contact_phone}`} className="flex items-center gap-1.5 hover:text-gray-700 transition-colors duration-150 cursor-pointer">
                <Phone className="h-3 w-3" />
                {s.contact_phone}
              </a>
            )}
            {s.contact_email && (
              <a href={`mailto:${s.contact_email}`} className="flex items-center gap-1.5 hover:text-gray-700 transition-colors duration-150 cursor-pointer">
                <Mail className="h-3 w-3" />
                {s.contact_email}
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/contact" className="hover:text-gray-700 transition-colors duration-150 cursor-pointer">İletişim</Link>
            <span className="text-gray-200">|</span>
            <Link href="/how-it-works" className="flex items-center gap-1 hover:text-gray-700 transition-colors duration-150 cursor-pointer">
              <HelpCircle className="h-3 w-3" />
              Yardım
            </Link>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
          {s.site_logo ? (
            <img src={s.site_logo} alt={s.site_title || 'NetTapu'} className="h-9 w-auto" />
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white text-sm font-extrabold shadow-sm shadow-brand-500/20">
                NT
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-bold text-gray-900 tracking-tight">{s.site_title || 'NetTapu'}</span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest -mt-0.5">Arsa & Açık Artırma</span>
              </div>
            </>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {mainNav.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <Link
            href="/parcels?view=map"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-brand-600 rounded-lg hover:bg-gray-50 transition-all duration-150 cursor-pointer"
          >
            <Map className="h-4 w-4" />
            <span className="hidden lg:inline">Harita</span>
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                href="/profile/favorites"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-rose-500 rounded-lg hover:bg-gray-50 transition-all duration-150 cursor-pointer"
              >
                <Heart className="h-4 w-4" />
                <span className="hidden lg:inline">Favoriler</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-brand-50/50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100/50 transition-all duration-150 cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}

              {/* Profile dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white overflow-hidden shadow-sm shadow-brand-500/20 cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    user?.email?.charAt(0).toUpperCase() || 'U'
                  )}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200/80 bg-white/95 backdrop-blur-xl shadow-xl shadow-gray-200/50 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50/50">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.email}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Kişisel Hesap</p>
                    </div>
                    <div className="py-1">
                      <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 cursor-pointer">
                        <User className="h-4 w-4 text-gray-400" />
                        Hesabım
                      </Link>
                      <Link href="/profile/favorites" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 cursor-pointer">
                        <Heart className="h-4 w-4 text-gray-400" />
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
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        Çıkış Yap
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-all duration-150 cursor-pointer"
              >
                Giriş Yap
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-sm font-semibold text-white hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-500/20 transition-all duration-200 cursor-pointer active:scale-[0.98]"
              >
                Üye Ol
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100 md:hidden cursor-pointer transition-colors duration-150"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5 text-gray-600" /> : <Menu className="h-5 w-5 text-gray-600" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-xl">
          <nav className="px-4 py-3 space-y-1">
            {mainNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 cursor-pointer ${
                    isActive ? 'text-brand-600 bg-brand-50' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
              <Link href="/parcels?view=map" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">
                <Map className="h-4 w-4 text-gray-400" />
                Harita
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <User className="h-4 w-4 text-gray-400" />
                    Hesabım
                  </Link>
                  <button
                    onClick={async () => {
                      setMobileOpen(false);
                      try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch {}
                      useAuthStore.getState().clearTokens();
                      window.location.href = '/login';
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
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
