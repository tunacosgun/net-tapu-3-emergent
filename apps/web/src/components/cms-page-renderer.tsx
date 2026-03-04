'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert } from '@/components/ui';
import type { CmsPage } from '@/types';

interface CmsPageRendererProps {
  slug: string;
}

export function CmsPageRenderer({ slug }: CmsPageRendererProps) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<CmsPage>(`/content/pages/${slug}`);
      setPage(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setError('Sayfa bulunamadı.');
      } else {
        setError('Sayfa yüklenirken bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  if (loading) return <LoadingState />;
  if (error) return <Alert className="mt-6">{error}</Alert>;
  if (!page) return null;

  return (
    <article>
      <h1 className="text-3xl font-bold">{page.title}</h1>
      {page.content && (
        <div
          className="prose mt-6 max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      )}
    </article>
  );
}
