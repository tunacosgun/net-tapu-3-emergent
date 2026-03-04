import type { Metadata } from 'next';
import { FaqContent } from './client';

export const metadata: Metadata = {
  title: 'Sıkça Sorulan Sorular — NetTapu',
  description: 'NetTapu hakkında sıkça sorulan sorular ve cevapları.',
  openGraph: {
    title: 'Sıkça Sorulan Sorular',
    description: 'NetTapu hakkında sıkça sorulan sorular ve cevapları.',
  },
};

export default function FaqPage() {
  return <FaqContent />;
}
