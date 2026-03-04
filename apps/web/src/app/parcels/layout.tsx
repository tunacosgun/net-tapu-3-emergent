import Link from 'next/link';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function ParcelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-lg font-bold text-brand-500">
            NetTapu
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex gap-4 text-sm">
              <Link href="/parcels" className="font-medium text-brand-500">
                Arsalar
              </Link>
              <Link href="/auctions" className="hover:text-brand-500 transition-colors">
                Açık Artırmalar
              </Link>
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
