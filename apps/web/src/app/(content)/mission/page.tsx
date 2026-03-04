import type { Metadata } from 'next';
import { CmsPageClient } from '@/components/cms-page-client';

const SLUG = 'mission';
const FALLBACK_TITLE = 'Misyon';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const res = await fetch(`${apiUrl}/api/v1/content/pages/${SLUG}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const page = await res.json();
      return {
        title: page.metaTitle || `${FALLBACK_TITLE} — NetTapu`,
        description: page.metaDescription || undefined,
        openGraph: {
          title: page.metaTitle || FALLBACK_TITLE,
          description: page.metaDescription || undefined,
        },
      };
    }
  } catch { /* fallback below */ }
  return { title: `${FALLBACK_TITLE} — NetTapu` };
}

export default function MissionPage() {
  return <CmsPageClient slug={SLUG} />;
}
