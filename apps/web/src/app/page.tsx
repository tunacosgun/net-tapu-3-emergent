'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TurkeyMap } from '@/components/turkey-map';

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="text-brand-500">NetTapu</span>
          </h1>
          <p className="mt-4 text-lg text-[var(--muted-foreground)]">
            Gayrimenkul ve arsa satışı için Türkiye&apos;nin canlı açık artırma
            platformu.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/parcels"
              className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition-colors"
            >
              Arsaları Keşfet
            </Link>
            <Link
              href="/auctions"
              className="rounded-lg border border-brand-500 px-6 py-3 text-sm font-semibold text-brand-500 shadow-sm hover:bg-brand-50 transition-colors"
            >
              Açık Artırmalar
            </Link>
          </div>
        </div>
      </section>

      {/* Map section */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <h2 className="text-2xl font-bold text-center">
          Türkiye Geneli Açık Artırmalar
        </h2>
        <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
          Bir ile tıklayarak o ildeki arsaları görüntüleyin.
        </p>
        <div className="mt-6">
          <TurkeyMap
            onProvinceClick={(province) => {
              router.push(`/parcels?city=${encodeURIComponent(province)}`);
            }}
          />
        </div>
      </section>
    </main>
  );
}
