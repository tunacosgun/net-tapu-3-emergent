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
  const [searchTerm, setSearchTerm] = useState('');

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

  // Filter by search
  const filtered = searchTerm
    ? faqs.filter(
        (f) =>
          f.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.answer.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : faqs;

  // Group by category
  const categories = new Map<string, Faq[]>();
  for (const faq of filtered) {
    const cat = faq.category || 'Genel';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(faq);
  }

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 px-8 py-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold lg:text-4xl">Sıkça Sorulan Sorular</h1>
          <p className="mt-2 text-base text-white/80 lg:text-lg">
            NetTapu hakkında merak ettiğiniz her şey
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <svg
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Soru ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-3 pl-10 pr-4 text-sm placeholder:text-[var(--muted-foreground)] focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
        />
      </div>

      {/* FAQ Categories */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">Aramanızla eşleşen soru bulunamadı.</p>
        </div>
      ) : (
        Array.from(categories.entries()).map(([category, items]) => (
          <section key={category} className="mb-8">
            {categories.size > 1 && (
              <div className="mb-4 flex items-center gap-2">
                <div className="h-6 w-1 rounded-full bg-brand-500" />
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {category}
                </h2>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                  {items.length}
                </span>
              </div>
            )}
            <div className="space-y-3">
              {items.map((faq) => {
                const isOpen = openId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className={`rounded-xl border transition-all duration-200 ${
                      isOpen
                        ? 'border-brand-200 bg-brand-50/30 shadow-sm'
                        : 'border-[var(--border)] hover:border-brand-100'
                    }`}
                  >
                    <button
                      onClick={() => toggle(faq.id)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left"
                    >
                      <span className={`text-sm font-medium pr-4 ${isOpen ? 'text-brand-700' : 'text-[var(--foreground)]'}`}>
                        {faq.question}
                      </span>
                      <div className={`shrink-0 rounded-full p-1 transition-colors ${isOpen ? 'bg-brand-100' : 'bg-[var(--muted)]'}`}>
                        <svg
                          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-600' : 'text-[var(--muted-foreground)]'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-brand-100 px-5 pb-5 pt-4">
                        <div
                          className="prose prose-sm max-w-none text-[var(--muted-foreground)] leading-relaxed
                            prose-a:text-brand-500 prose-strong:text-[var(--foreground)]"
                          dangerouslySetInnerHTML={{ __html: faq.answer }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Contact CTA */}
      <div className="mt-10 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-brand-100/50 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-brand-800">Aradığınızı bulamadınız mı?</h3>
            <p className="mt-1 text-sm text-brand-600">Uzman ekibimiz size yardımcı olmaya hazır.</p>
          </div>
          <a
            href="/about"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            Bize Ulaşın
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
