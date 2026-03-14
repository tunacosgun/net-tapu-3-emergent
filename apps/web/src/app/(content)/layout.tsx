'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navLinks = [
  { href: '/about', label: 'Hakkimizda' },
  { href: '/vision', label: 'Vizyon' },
  { href: '/mission', label: 'Misyon' },
  { href: '/how-it-works', label: 'Nasil Calisir' },
  { href: '/faq', label: 'S.S.S.' },
  { href: '/references', label: 'Referanslar' },
  { href: '/press', label: 'Basin' },
  { href: '/legal', label: 'Yasal Bilgiler' },
  { href: '/withdrawal-rights', label: 'Cayma Hakki' },
  { href: '/real-estate-guide', label: 'Gayrimenkul Rehberi' },
  { href: '/post-sale', label: 'Satis Sonrasi' },
  { href: '/contact', label: 'Iletisim' },
];

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentLink = navLinks.find((l) => pathname === l.href || pathname.startsWith(l.href + '/'));

  return (
    <div className="bg-white min-h-screen">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-brand-500">Ana Sayfa</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{currentLink?.label || 'Kurumsal'}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Mobile nav toggle */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium"
          >
            <span>{currentLink?.label || 'Kurumsal Sayfalar'}</span>
            <svg className={`h-4 w-4 text-gray-400 transition-transform ${mobileOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {mobileOpen && (
            <div className="mt-1 rounded-lg border border-gray-200 bg-white shadow-sm">
              <nav className="divide-y divide-gray-100">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`block px-4 py-2.5 text-sm ${
                        isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        <div className="lg:flex lg:gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block lg:w-56 lg:shrink-0">
            <div className="sticky top-24">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-3">Kurumsal</h2>
              <nav className="flex flex-col gap-0.5">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`rounded-md px-3 py-2 text-sm ${
                        isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-900">Sorulariniz mi var?</p>
                <p className="mt-1 text-xs text-gray-500">Uzman ekibimize ulasin.</p>
                <Link href="/contact" className="mt-3 inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors">
                  Bize Ulasin
                </Link>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 max-w-4xl">{children}</main>
        </div>
      </div>
    </div>
  );
}
