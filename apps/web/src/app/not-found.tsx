import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-brand-500">404</h1>
        <p className="mt-4 text-xl font-semibold">Sayfa Bulunamadı</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </main>
  );
}
