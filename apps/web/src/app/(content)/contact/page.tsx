import type { Metadata } from 'next';
import { ContactPageContent } from './client';

export const metadata: Metadata = {
  title: 'İletişim — NetTapu',
  description: 'NetTapu ile iletişime geçin. Sorularınız, önerileriniz veya destek talepleriniz için bize ulaşın.',
  openGraph: {
    title: 'İletişim — NetTapu',
    description: 'NetTapu ile iletişime geçin. Sorularınız, önerileriniz veya destek talepleriniz için bize ulaşın.',
  },
};

export default function ContactPage() {
  return <ContactPageContent />;
}
