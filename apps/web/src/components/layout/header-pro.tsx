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
  const [notificationCount] = useState(3);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 20); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/forgot-password');
  const isAdminPage = pathname?.startsWith('/admin');
  if (isAuthPage || isAdminPage) return null;

  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('superadmin');

  return (
    <>
      <div className="h-[72px] lg:h-[108px]" />
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
            : 'bg-white'
        }`}
        data-testid="main-header"
      >
        {/* Top utility bar - Professional clean design */}
        <div className="hidden lg:block bg-slate-50">
          <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-6 text-xs">
            <div className="flex items-center gap-6">
              {s.contact_phone && (
                <a 
                  href={`tel:${s.contact_phone}`} 
                  className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors duration-200"
                  data-testid="header-phone"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="font-medium">{s.contact_phone}</span>
                </a>
              )}
              {s.contact_email && (
                <a 
                  href={`mailto:${s.contact_email}`} 
                  className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors duration-200"
                  data-testid="header-email"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="font-medium">{s.contact_email}</span>
                </a>
              )}
            </div>
            <div className="flex items-center gap-6">
              <Link 
                href="/contact" 
                className="font-medium text-slate-500 hover:text-emerald-600 transition-colors duration-200"
              >
                İletişim
              </Link>
              <Link 
                href="/how-it-works" 
                className="flex items-center gap-1.5 font-medium text-slate-500 hover:text-emerald-600 transition-colors duration-200"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Yardım
              </Link>
            </div>
          </div>
        </div>

        {/* Main navigation - Clean professional */}
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group" data-testid="header-logo">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-emerald transition-transform duration-200 group-hover:scale-105">
              NT
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold font-heading text-slate-900 tracking-tight">
                {s.site_title || 'NetTapu'}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                Arsa & Açık Artırma
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1" data-testid="desktop-nav">
            {mainNav.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  data-testid={`nav-link-${item.href.replace('/', '')}`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Search - Desktop only */}
            <button 
              className="hidden lg:flex items-center justify-center h-10 w-10 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-all duration-200"
              data-testid="header-search-btn"
            >
              <Search className="h-5 w-5" />
            </button>

            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <button 
                  className="relative flex items-center justify-center h-10 w-10 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-all duration-200"
                  data-testid="header-notifications-btn"
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"></span>
                  )}
                </button>

                {/* Favorites */}
                <Link
                  href="/profile/favorites"
                  className="hidden lg:flex items-center justify-center h-10 w-10 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-50 transition-all duration-200"
                  data-testid="header-favorites-btn"
                >
                  <Heart className="h-5 w-5" />
                </Link>

                {/* Admin Badge */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="hidden lg:flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-all duration-200"
                    data-testid="header-admin-btn"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>Admin</span>
                  </Link>
                )}

                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white overflow-hidden shadow-sm transition-all duration-200 hover:bg-emerald-700"
                    data-testid="header-profile-btn"
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
                        className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden"
                        onMouseLeave={() => setProfileOpen(false)}
                        data-testid="profile-dropdown"
                      >
                        {/* Profile Header */}
                        <div className="px-4 py-4 bg-slate-50">
                          <p className="text-sm font-bold font-heading text-slate-900 truncate">{user?.email}</p>
                          <p className="text-xs text-slate-500 mt-1 font-medium">Kişisel Hesap</p>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          <Link
                            href="/profile"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
                          >
                            <User className="h-4 w-4 text-slate-400" />
                            <span>Hesabım</span>
                          </Link>
                          <Link
                            href="/profile/favorites"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
                          >
                            <Heart className="h-4 w-4 text-slate-400" />
                            <span>Favorilerim</span>
                          </Link>
                          <Link
                            href="/profile/auctions"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
                          >
                            <Gavel className="h-4 w-4 text-slate-400" />
                            <span>İhalelerim</span>
                          </Link>
                          <Link
                            href="/profile/payments"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
                          >
                            <CreditCard className="h-4 w-4 text-slate-400" />
                            <span>Ödemeler</span>
                          </Link>
                        </div>

                        {/* Logout */}
                        <div className="py-2 border-t border-slate-100">
                          <button
                            onClick={async () => {
                              setProfileOpen(false);
                              try { await fetch('/api/auth/session', { method: 'DELETE' }); } catch {}
                              useAuthStore.getState().clearTokens();
                              window.location.href = '/login';
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-150"
                            data-testid="logout-btn"
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
                  className="hidden lg:block px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-all duration-200"
                  data-testid="header-login-btn"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm hover:shadow transition-all duration-200"
                  data-testid="header-register-btn"
                >
                  Üye Ol
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="ml-2 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-50 lg:hidden transition-colors duration-200"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
              data-testid="mobile-menu-toggle"
            >
              {mobileOpen ? <X className="h-5 w-5 text-slate-600" /> : <Menu className="h-5 w-5 text-slate-600" />}
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
              className="lg:hidden bg-white shadow-lg"
              data-testid="mobile-menu"
            >
              <nav className="px-4 py-4 space-y-1">
                {mainNav.map((item) => {
                  const isActive = pathname?.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-colors duration-150 ${
                        isActive ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {Icon && <Icon className="h-5 w-5" />}
                      {item.label}
                    </Link>
                  );
                })}
                {isAuthenticated && (
                  <>
                    <div className="pt-2 mt-2 border-t border-slate-100 space-y-1">
                      <Link
                        href="/profile"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg"
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
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg"
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
