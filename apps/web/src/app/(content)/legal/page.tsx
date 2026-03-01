import type { Metadata } from 'next';
import { LegalContent } from './client';

export const metadata: Metadata = {
  title: 'Yasal Bilgiler — NetTapu',
  description: 'NetTapu yasal bilgiler, cayma hakkı ve kullanım koşulları.',
  openGraph: {
    title: 'Yasal Bilgiler',
    description: 'NetTapu yasal bilgiler, cayma hakkı ve kullanım koşulları.',
  },
};

export default function LegalPage() {
  return <LegalContent />;
}
