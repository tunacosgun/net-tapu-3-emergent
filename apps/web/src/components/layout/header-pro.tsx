'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteSettings } from '@/hooks/use-site-settings';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map, Heart, Shield, User, LogOut, Menu, X, Bell,
  ChevronDown, Phone, Mail, HelpCircle, Search,
  Settings, CreditCard, Package, Gavel
} from 'lucide-react';

const mainNav = [
  { href: '/parcels', label: 'Arsalar', icon: Map },
  { href: '/auctions', label: 'Açık Artırmalar', icon: Gavel },
  { href: '/how-it-works', label: 'Nasıl Çalışır?', icon: HelpCircle },
  { href: '/about', label: 'Hakkımızda' },
];

export function HeaderPro() {
  const pathname = usePathname();
  const { isAuthenticated, user, avatarUrl } = useAuthStore();
  const s = useSiteSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notificationCount] = useState(3); // TODO: Connect to real notifications

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 20); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hide header on auth and admin pages
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/forgot-password');
  const isAdminPage = pathname?.startsWith('/admin');
  if (isAuthPage || isAdminPage) return null;

  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('superadmin');

  return (
    <>
    {/* Spacer for fixed header */}
    <div className="h-[116px]" />
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-lg shadow-slate-900/5'
          : 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-transparent'
      }`}
    >
      {/* Top utility bar */}
      <div className="hidden lg:block border-b border-slate-100/80 dark:border-slate-800/80">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-6 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-5">
            {s.contact_phone && (
              <a href={`tel:${s.contact_phone}`} className="flex items-center gap-2 hover:text-slate-700 dark:hover:text-slate-300 transition-colors duration-200 cursor-pointer group">
                <Phone className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                <span className="font-medium">{s.contact_phone}</span>
              </a>
            )}
            {s.contact_email && (
              <a href={`mailto:${s.contact_email}`} className="flex items-center gap-2 hover:text-slate-700 dark:hover:text-slate-300 transition-colors duration-200 cursor-pointer group">
                <Mail className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                <span className="font-medium">{s.contact_email}</span>
              </a>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="font-medium hover:text-slate-700 dark:hover:text-slate-300 transition-colors duration-200 cursor-pointer">İletişim</Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <Link href="/how-it-works" className="flex items-center gap-1.5 font-medium hover:text-slate-700 dark:hover:text-slate-300 transition-colors duration-200 cursor-pointer">
              <HelpCircle className="h-3.5 w-3.5" />
              Yardım
            </Link>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-base font-bold shadow-lg shadow-emerald-500/30">
              NT
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">{s.site_title || 'NetTapu'}</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em] -mt-0.5">Arsa & Açık Artırma</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {mainNav.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer group ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Search - Desktop only */}
          <button className="hidden lg:flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer">
            <Search className="h-4 w-4" />
          </button>

          {isAuthenticated ? (
            <>
              {/* Notifications */}
              <button className="relative flex items-center justify-center h-10 w-10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer">
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
                )}
              </button>

              {/* Favorites */}
              <Link
                href="/profile/favorites"
                className="hidden lg:flex items-center justify-center h-10 w-10 text-slate-500 dark:text-slate-400 hover:text-rose-500 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer"
              >
                <Heart className="h-5 w-5" />
              </Link>

              {/* Admin Badge */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden lg:flex items-center gap-2 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all duration-200 cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>Admin</span>
                </Link>
              )}

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white overflow-hidden shadow-lg shadow-emerald-500/30 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-95"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    user?.email?.charAt(0).toUpperCase() || 'U'
                  )}
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-slate-900/10 overflow-hidden"
                      onMouseLeave={() => setProfileOpen(false)}
                    >
                      {/* Profile Header */}
                      <div className="px-4 py-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200/50 dark:border-slate-700/50">
                        <p className="text-sm font-bold font-heading text-slate-900 dark:text-white truncate">{user?.email}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Kişisel Hesap</p>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <Link
                          href="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 cursor-pointer group"
                        >
                          <User className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          <span>Hesabım</span>
                        </Link>
                        <Link
                          href="/profile/favorites"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 cursor-pointer group"
                        >
                          <Heart className="h-4 w-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
                          <span>Favorilerim</span>
                        </Link>
                        <Link
                          href="/profile/auctions"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 cursor-pointer group"
                        >
                          <Gavel className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          <span>İhalelerim</span>
                        </Link>
                        <Link
                          href="/profile/payments"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 cursor-pointer group"
                        >
                          <CreditCard className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          <span>Ödemeler</span>
                        </Link>
                      </div>

                      {/* Logout */}
                      <div className="border-t border-slate-200/50 dark:border-slate-700/50 py-2">
                        <button
                          onClick={async () => {
                            setProfileOpen(false);
                            try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch {}
                            useAuthStore.getState().clearTokens();
                            window.location.href = '/login';
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer group"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Çıkış Yap</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden lg:block px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer"
              >
                Giriş Yap
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
              >
                Üye Ol
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="ml-2 flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 lg:hidden cursor-pointer transition-colors duration-200"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5 text-slate-600 dark:text-slate-300" /> : <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl"
          >
            <nav className="px-4 py-4 space-y-1">
              {mainNav.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-colors duration-150 cursor-pointer ${
                      isActive ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    {item.label}
                  </Link>
                );
              })}
              {isAuthenticated && (
                <>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-2 space-y-1">
                    <Link
                      href="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer"
                    >
                      <User className="h-5 w-5 text-slate-400" />
                      Hesabım
                    </Link>
                    <button
                      onClick={async () => {
                        setMobileOpen(false);
                        try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch {}
                        useAuthStore.getState().clearTokens();
                        window.location.href = '/login';
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl cursor-pointer"
                    >
                      <LogOut className="h-5 w-5" />
                      Çıkış Yap
                    </button>
                  </div>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    </>
  );
}
