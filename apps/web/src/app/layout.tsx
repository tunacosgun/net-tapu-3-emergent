import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { ApiErrorToastContainer } from '@/components/api-error-toast';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'NetTapu — Gayrimenkul Açık Artırma Platformu',
    template: '%s | NetTapu',
  },
  description:
    'Arsa ve gayrimenkul satışı için Türkiye\'nin güvenilir canlı açık artırma platformu. Arsa ilanları, teklif sistemi ve online ihale.',
  keywords: [
    'arsa satışı',
    'gayrimenkul',
    'açık artırma',
    'online ihale',
    'arsa ilanları',
    'NetTapu',
    'gayrimenkul portali',
    'arazi satış',
  ],
  authors: [{ name: 'NetTapu' }],
  creator: 'NetTapu',
  publisher: 'NetTapu',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://nettapu.com'),
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: '/',
    siteName: 'NetTapu',
    title: 'NetTapu — Gayrimenkul Açık Artırma Platformu',
    description: 'Arsa ve gayrimenkul satışı için Türkiye\'nin güvenilir canlı açık artırma platformu.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NetTapu — Gayrimenkul Açık Artırma Platformu',
    description: 'Arsa ve gayrimenkul satışı için canlı açık artırma platformu.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={inter.className}>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <ErrorBoundary>
          <AuthProvider>
            {children}
            <ApiErrorToastContainer />
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
