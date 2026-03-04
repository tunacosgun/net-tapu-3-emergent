'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState } from '@/components/ui';
import type { Faq } from '@/types';

export function FaqContent() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<Faq[]>('/content/faq');
      setFaqs(data);
    } catch {
      setError('Sorular yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  if (loading) return <LoadingState />;
  if (error) return <Alert className="mt-6">{error}</Alert>;
  if (faqs.length === 0) return <EmptyState message="Henüz soru eklenmemiş." />;

  // Group by category
  const categories = new Map<string, Faq[]>();
  for (const faq of faqs) {
    const cat = faq.category || 'Genel';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(faq);
  }

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Sıkça Sorulan Sorular</h1>

      {Array.from(categories.entries()).map(([category, items]) => (
        <section key={category} className="mt-8">
          {categories.size > 1 && (
            <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              {category}
            </h2>
          )}
          <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {items.map((faq) => (
              <div key={faq.id}>
                <button
                  onClick={() => toggle(faq.id)}
                  className="flex w-full items-center justify-between px-4 py-4 text-left text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                >
                  <span>{faq.question}</span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform ${openId === faq.id ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openId === faq.id && (
                  <div className="px-4 pb-4 text-sm text-[var(--muted-foreground)]">
                    <div dangerouslySetInnerHTML={{ __html: faq.answer }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
