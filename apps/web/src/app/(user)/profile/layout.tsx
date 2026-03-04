'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

const profileNavItems = [
  { href: '/profile', label: 'Profilim', icon: '👤' },
  { href: '/profile/favorites', label: 'Favorilerim', icon: '❤️' },
  { href: '/profile/offers', label: 'Tekliflerim', icon: '💰' },
  { href: '/profile/auctions', label: 'İhale Geçmişim', icon: '🔨' },
  { href: '/profile/payments', label: 'Ödeme Geçmişim', icon: '💳' },
  { href: '/profile/notifications', label: 'Bildirim Ayarları', icon: '🔔' },
];

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?returnTo=/profile');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Yükleniyor...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Hesabım</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{user.email}</p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="lg:w-56 shrink-0">
          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {profileNavItems.map((item) => {
              const isActive =
                item.href === '/profile'
                  ? pathname === '/profile'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
