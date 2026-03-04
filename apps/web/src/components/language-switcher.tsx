'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

const LOCALE_LABELS: Record<Locale, { label: string; flag: string }> = {
  tr: { label: 'Türkçe', flag: '🇹🇷' },
  en: { label: 'English', flag: '🇬🇧' },
};

export function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const currentLocale = (
    typeof document !== 'undefined'
      ? document.cookie
          .split('; ')
          .find((c) => c.startsWith('locale='))
          ?.split('=')[1]
      : 'tr'
  ) as Locale || 'tr';

  const switchLocale = useCallback(
    (locale: Locale) => {
      // Set cookie for locale preference
      document.cookie = `locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    },
    [router],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
        aria-label="Change language"
      >
        <span>{LOCALE_LABELS[currentLocale]?.flag ?? '🌐'}</span>
        <span className="hidden sm:inline">{LOCALE_LABELS[currentLocale]?.label ?? currentLocale.toUpperCase()}</span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 rounded-md border border-[var(--border)] bg-[var(--background)] shadow-lg min-w-[140px]">
            {locales.map((locale) => (
              <button
                key={locale}
                onClick={() => switchLocale(locale)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors ${
                  locale === currentLocale ? 'font-semibold text-brand-600' : ''
                }`}
              >
                <span>{LOCALE_LABELS[locale].flag}</span>
                <span>{LOCALE_LABELS[locale].label}</span>
                {locale === currentLocale && (
                  <svg className="ml-auto h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
