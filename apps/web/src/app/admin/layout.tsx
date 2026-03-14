'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

const ADMIN_ROLES = ['superadmin', 'admin'];

const navSections = [
  {
    title: null,
    items: [
      { href: '/admin', label: 'Genel Bakış', icon: '🏠' },
      { href: '/admin/analytics', label: 'Analitik', icon: '📊' },
    ],
  },
  {
    title: 'Kullanıcılar',
    items: [
      { href: '/admin/users', label: 'Kullanıcılar', icon: '👥' },
      { href: '/admin/bans', label: 'Yasaklamalar', icon: '🚫' },
    ],
  },
  {
    title: 'Gayrimenkul',
    items: [
      { href: '/admin/parcels', label: 'Arsalar', icon: '📦' },
      { href: '/admin/auctions', label: 'Açık Artırmalar', icon: '🔨' },
    ],
  },
  {
    title: 'Finans',
    items: [
      { href: '/admin/deposits', label: 'Depozitolar', icon: '💳' },
      { href: '/admin/reconciliation', label: 'Mutabakat', icon: '📋' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { href: '/admin/contacts', label: 'İletişim Talepleri', icon: '📞' },
      { href: '/admin/appointments', label: 'Randevular', icon: '📅' },
      { href: '/admin/offers', label: 'Teklifler', icon: '💰' },
    ],
  },
  {
    title: 'İçerik',
    items: [
      { href: '/admin/pages', label: 'Sayfalar', icon: '📄' },
      { href: '/admin/faq', label: 'S.S.S.', icon: '❓' },
      { href: '/admin/references', label: 'Referanslar', icon: '🏆' },
      { href: '/admin/testimonials', label: 'Yorumlar', icon: '💬' },
    ],
  },
  {
    title: 'Pazarlama',
    items: [
      { href: '/admin/campaigns', label: 'Kampanyalar', icon: '🎯' },
      { href: '/admin/dealers', label: 'Bayiler / Danışmanlar', icon: '🤝' },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { href: '/admin/settings', label: 'Ayarlar', icon: '⚙️' },
      { href: '/admin/notifications', label: 'Bildirimler', icon: '🔔' },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?returnTo=/admin');
      return;
    }
    if (user && !user.roles?.some((r) => ADMIN_ROLES.includes(r))) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Yükleniyor...</p>
      </div>
    );
  }

  if (!user || !user.roles?.some((r) => ADMIN_ROLES.includes(r))) {
    return null;
  }

  return (
    <div className="flex flex-1">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--muted)] p-4 lg:block">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-brand-500">
            <span className="text-xs font-bold text-white">NT</span>
          </div>
          <span className="text-sm font-bold text-brand-500">Admin Panel</span>
        </div>
        <nav className="mt-4 space-y-4">
          {navSections.map((section, i) => (
            <div key={i}>
              {section.title && (
                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {section.title}
                </p>
              )}
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-[var(--background)] transition-colors"
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="border-b border-[var(--border)] px-6 py-2 flex items-center justify-between bg-[var(--muted)]/50">
          <span className="text-xs text-[var(--muted-foreground)]">
            Admin: {user.email}
          </span>
          <Link href="/" className="text-xs text-brand-500 hover:underline">
            Siteye Dön →
          </Link>
        </div>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
