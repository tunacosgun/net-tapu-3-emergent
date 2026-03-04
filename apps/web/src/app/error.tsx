'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-red-500">500</h1>
        <p className="mt-4 text-xl font-semibold">Sunucu Hatası</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {error.message || 'Beklenmeyen bir hata oluştu.'}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Hata kodu: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-brand-500 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
