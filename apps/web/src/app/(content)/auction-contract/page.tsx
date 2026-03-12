import type { Metadata } from 'next';
import { AuctionContractContent } from './client';

export const metadata: Metadata = {
  title: 'İhale Katılım Sözleşmesi — NetTapu',
  description: 'NetTapu e-ihale katılım sözleşmesi, hak ve yükümlülükler.',
  openGraph: {
    title: 'İhale Katılım Sözleşmesi',
    description: 'NetTapu e-ihale katılım sözleşmesi, hak ve yükümlülükler.',
  },
};

export default function AuctionContractPage() {
  return <AuctionContractContent />;
}
