'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState } from '@/components/ui';
import type { CmsPage, PaginatedResponse } from '@/types';

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
      const all = [...withdrawalRes.data.data, ...legalRes.data.data];
      setSections(all);
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

  return (
    <div>
      <h1 className="text-3xl font-bold">Yasal Bilgiler</h1>

      {sections.length > 1 && (
        <div className="mt-6 flex gap-1 border-b border-[var(--border)]">
          {sections.map((section, idx) => (
            <button
              key={section.id}
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === idx
                  ? 'border-b-2 border-brand-500 text-brand-500'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>
      )}

      {sections[activeTab] && (
        <article className="mt-6">
          {sections.length === 1 && (
            <h2 className="text-xl font-semibold">{sections[activeTab].title}</h2>
          )}
          {sections[activeTab].content && (
            <div
              className="prose mt-4 max-w-none"
              dangerouslySetInnerHTML={{ __html: sections[activeTab].content! }}
            />
          )}
        </article>
      )}
    </div>
  );
}
