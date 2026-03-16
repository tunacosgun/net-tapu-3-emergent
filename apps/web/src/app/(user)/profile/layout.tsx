'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

const profileNavItems = [
  { href: '/profile', label: 'Profilim' },
  { href: '/profile/favorites', label: 'Favorilerim' },
  { href: '/profile/offers', label: 'Tekliflerim' },
  { href: '/profile/auctions', label: 'Ihale Gecmisim' },
  { href: '/profile/payments', label: 'Odeme Gecmisim' },
  { href: '/profile/saved-searches', label: 'Kayıtlı Aramalar' },
  { href: '/profile/notifications', label: 'Bildirim Ayarlari' },
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
        <p className="text-gray-500">Yukleniyor...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="bg-white min-h-screen">
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Hesabim</h1>
          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar */}
          <aside className="lg:w-52 shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 border-b lg:border-b-0 border-gray-200">
              {profileNavItems.map((item) => {
                const isActive =
                  item.href === '/profile'
                    ? pathname === '/profile'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
