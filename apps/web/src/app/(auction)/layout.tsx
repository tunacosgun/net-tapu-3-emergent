export default function AuctionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="/" className="text-lg font-bold text-brand-500">
            NetTapu
          </a>
          <nav className="flex gap-4 text-sm">
            <a href="/parcels" className="hover:text-brand-500 transition-colors">
              Arsalar
            </a>
            <a href="/auctions" className="hover:text-brand-500 transition-colors">
              Açık Artırmalar
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
