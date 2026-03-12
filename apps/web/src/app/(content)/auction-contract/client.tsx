'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState } from '@/components/ui';
import { CmsBlockRenderer } from '@/components/cms-block-renderer';
import type { CmsPage, PaginatedResponse } from '@/types';
import type { ContentBlock } from '@/components/block-editor';

function parseBlocks(content: string | null): ContentBlock[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((b: Record<string, unknown>) => {
      if (b.data && typeof b.data === 'object') {
        return { type: b.type, ...(b.data as Record<string, unknown>) } as unknown as ContentBlock;
      }
      return b as unknown as ContentBlock;
    });
  } catch {
    return [{ type: 'text', content } as ContentBlock];
  }
}

export function AuctionContractContent() {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get<PaginatedResponse<CmsPage>>('/content/pages', {
          params: { pageType: 'auction_contract', status: 'published' },
        });
        setPage(data.data[0] ?? null);
      } catch {
        setError('Sayfa yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <Alert className="mt-6">{error}</Alert>;
  if (!page) return <EmptyState message="İhale katılım sözleşmesi henüz eklenmemiş." />;

  const blocks = parseBlocks(page.content ?? null);

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 px-8 py-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold lg:text-4xl">İhale Katılım Sözleşmesi</h1>
          <p className="mt-2 text-base text-white/70 lg:text-lg">
            E-ihale katılım koşulları, hak ve yükümlülükler
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/auction-rules" className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-950/20 dark:border-brand-800 px-4 py-2.5 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-100 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
          Açık Artırma Kuralları
        </Link>
        <Link href="/legal" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Yasal Bilgiler
        </Link>
      </div>

      {/* Content */}
      <article className="rounded-xl border border-[var(--border)] p-6 lg:p-8">
        <CmsBlockRenderer blocks={blocks} />

        {page.updatedAt && (
          <div className="mt-8 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Son güncelleme: {new Date(page.updatedAt).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        )}
      </article>
    </div>
  );
}
