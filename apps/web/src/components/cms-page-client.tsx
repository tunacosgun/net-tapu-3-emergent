'use client';

import { Suspense } from 'react';
import { CmsPageRenderer } from '@/components/cms-page-renderer';
import { LoadingState } from '@/components/ui';

interface CmsPageClientProps {
  slug: string;
  showHero?: boolean;
  subtitle?: string;
  heroIcon?: string;
  fallback?: React.ReactNode;
}

export function CmsPageClient({ slug, showHero, subtitle, heroIcon, fallback }: CmsPageClientProps) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CmsPageRenderer
        slug={slug}
        showHero={showHero}
        subtitle={subtitle}
        heroIcon={heroIcon}
        fallback={fallback}
      />
    </Suspense>
  );
}
