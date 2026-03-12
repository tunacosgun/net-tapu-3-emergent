import type { Metadata } from 'next';
import { AuctionRulesContent } from './client';

export const metadata: Metadata = {
  title: 'Açık Artırma Kuralları — NetTapu',
  description: 'NetTapu e-ihale açık artırma kuralları, katılım şartları ve teklif verme süreci.',
  openGraph: {
    title: 'Açık Artırma Kuralları',
    description: 'NetTapu e-ihale açık artırma kuralları, katılım şartları ve teklif verme süreci.',
  },
};

export default function AuctionRulesPage() {
  return <AuctionRulesContent />;
}
