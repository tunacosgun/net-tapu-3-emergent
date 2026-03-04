import type { Metadata } from 'next';
import { ReferencesContent } from './client';

export const metadata: Metadata = {
  title: 'Referanslar — NetTapu',
  description: 'NetTapu iş ortakları ve referansları.',
  openGraph: {
    title: 'Referanslar',
    description: 'NetTapu iş ortakları ve referansları.',
  },
};

export default function ReferencesPage() {
  return <ReferencesContent />;
}
