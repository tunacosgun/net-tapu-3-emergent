import type { Metadata } from 'next';
import { TestimonialsContent } from './client';
import { BreadcrumbJsonLd } from '@/components/json-ld';

export const metadata: Metadata = {
  title: 'Musteri Yorumlari — NetTapu',
  description: 'NetTapu musterilerinin deneyimleri ve memnuniyet yorumlari.',
  openGraph: {
    title: 'Musteri Yorumlari',
    description: 'NetTapu musterilerinin deneyimleri ve memnuniyet yorumlari.',
  },
};

export default function TestimonialsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Ana Sayfa', url: 'https://nettapu.com' },
          { name: 'Musteri Yorumlari', url: 'https://nettapu.com/testimonials' },
        ]}
      />
      <TestimonialsContent />
    </>
  );
}
