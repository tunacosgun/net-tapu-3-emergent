'use client';

import { useEffect, useState, useCallback } from 'react';
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
    // Unwrap {type, data: {...}} format to flat {type, ...data}
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

export function LegalContent() {
  const [sections, setSections] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const fetchLegalPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [legalRes, withdrawalRes] = await Promise.all([
        apiClient.get<PaginatedResponse<CmsPage>>('/content/pages', {
          params: { pageType: 'legal_info', status: 'published' },
        }),
        apiClient.get<PaginatedResponse<CmsPage>>('/content/pages', {
          params: { pageType: 'withdrawal_info', status: 'published' },
        }),
      ]);
      const map = new Map<string, CmsPage>();
      for (const p of [...legalRes.data.data, ...withdrawalRes.data.data]) {
        map.set(p.id, p);
      }
      setSections(Array.from(map.values()));
    } catch {
      setError('Yasal bilgiler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLegalPages();
  }, [fetchLegalPages]);

  if (loading) return <LoadingState />;
  if (error) return <Alert className="mt-6">{error}</Alert>;
  if (sections.length === 0) return <EmptyState message="Henüz yasal bilgi eklenmemiş." />;

  const activeSection = sections[activeTab];
  const blocks = parseBlocks(activeSection?.content ?? null);

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 px-8 py-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold lg:text-4xl">Yasal Bilgiler</h1>
          <p className="mt-2 text-base text-white/70 lg:text-lg">
            Kullanım koşulları, gizlilik politikası ve yasal düzenlemeler
          </p>
        </div>
      </div>

      {/* Tabs */}
      {sections.length > 1 && (
        <div className="mb-8 flex gap-1 overflow-x-auto rounded-xl bg-[var(--muted)] p-1">
          {sections.map((section, idx) => (
            <button
              key={section.id}
              onClick={() => setActiveTab(idx)}
              className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === idx
                  ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeSection && (
        <article className="rounded-xl border border-[var(--border)] p-6 lg:p-8">
          <CmsBlockRenderer blocks={blocks} />

          {activeSection.updatedAt && (
            <div className="mt-8 border-t border-[var(--border)] pt-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                Son güncelleme: {new Date(activeSection.updatedAt).toLocaleDateString('tr-TR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
