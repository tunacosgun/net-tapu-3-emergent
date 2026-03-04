import Link from 'next/link';

const navLinks = [
  { href: '/about', label: 'Hakkımızda' },
  { href: '/vision', label: 'Vizyon' },
  { href: '/mission', label: 'Misyon' },
  { href: '/faq', label: 'S.S.S.' },
  { href: '/references', label: 'Referanslar' },
  { href: '/press', label: 'Basın' },
  { href: '/legal', label: 'Yasal Bilgiler' },
  { href: '/real-estate-guide', label: 'Gayrimenkul Rehberi' },
];

export default function ContentLayout({
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
          <nav className="flex gap-4 text-sm">
            <Link href="/parcels" className="hover:text-brand-500 transition-colors">
              Arsalar
            </Link>
            <Link href="/auctions" className="hover:text-brand-500 transition-colors">
              Acik Artirmalar
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:flex lg:gap-10">
        <aside className="mb-8 lg:mb-0 lg:w-56 lg:shrink-0">
          <nav className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 max-w-4xl">
          {children}
        </main>
      </div>
    </div>
  );
}
