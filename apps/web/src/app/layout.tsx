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
  title: 'NetTapu — Gayrimenkul Açık Artırma Platformu',
  description:
    'Arsa ve gayrimenkul satışı için canlı açık artırma platformu.',
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
