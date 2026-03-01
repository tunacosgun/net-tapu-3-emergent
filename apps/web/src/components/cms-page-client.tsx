'use client';

import { Suspense } from 'react';
import { CmsPageRenderer } from '@/components/cms-page-renderer';
import { LoadingState } from '@/components/ui';

export function CmsPageClient({ slug }: { slug: string }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <CmsPageRenderer slug={slug} />
    </Suspense>
  );
}
