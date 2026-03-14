import type { Metadata } from 'next';
import { ProjectsContent } from './client';
import { BreadcrumbJsonLd } from '@/components/json-ld';

export const metadata: Metadata = {
  title: 'Projelerimiz — NetTapu',
  description:
    'NetTapu tarafindan tamamlanan gayrimenkul projeleri. Basarili arsa satislari ve ihale sonuclari.',
  openGraph: {
    title: 'Projelerimiz',
    description: 'NetTapu tarafindan tamamlanan gayrimenkul projeleri.',
  },
};

export default function ProjectsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Ana Sayfa', url: 'https://nettapu.com' },
          { name: 'Projelerimiz', url: 'https://nettapu.com/projects' },
        ]}
      />
      <ProjectsContent />
    </>
  );
}
