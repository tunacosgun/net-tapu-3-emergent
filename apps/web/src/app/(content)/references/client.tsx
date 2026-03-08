'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState } from '@/components/ui';
import type { Reference } from '@/types';

const refTypeLabels: Record<string, string> = {
  partner: 'İş Ortağı',
  project: 'Tamamlanan Proje',
  media: 'Medya',
  certification: 'Sertifika',
};

const refTypeIcons: Record<string, string> = {
  partner: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  project: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  media: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  certification: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
};

export function ReferencesContent() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<Reference[]>('/content/references');
      setReferences(data);
    } catch {
      setError('Referanslar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState />;
  if (error) return <Alert className="mt-6">{error}</Alert>;

  // Get unique types
  const types = Array.from(new Set(references.map((r) => r.referenceType)));
  const filtered = activeType
    ? references.filter((r) => r.referenceType === activeType)
    : references;

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 px-8 py-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold lg:text-4xl">Referanslar</h1>
          <p className="mt-2 text-base text-white/80 lg:text-lg">
            İş ortaklarımız ve başarılı projelerimiz
          </p>
        </div>
      </div>

      {/* Type filter tabs */}
      {types.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveType(null)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeType === null
                ? 'bg-brand-500 text-white shadow-md'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-brand-50 hover:text-brand-600'
            }`}
          >
            Tümü ({references.length})
          </button>
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeType === type
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-brand-50 hover:text-brand-600'
              }`}
            >
              {refTypeLabels[type] || type} ({references.filter((r) => r.referenceType === type).length})
            </button>
          ))}
        </div>
      )}

      {/* References Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ref) => (
            <div
              key={ref.id}
              className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] transition-all duration-300 hover:shadow-lg hover:border-brand-200"
            >
              {/* Image */}
              {ref.imageUrl ? (
                <div className="relative h-44 overflow-hidden bg-[var(--muted)]">
                  <img
                    src={ref.imageUrl}
                    alt={ref.title}
                    className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3">
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--foreground)] shadow-sm backdrop-blur-sm">
                      {refTypeLabels[ref.referenceType] || ref.referenceType}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                  <svg
                    className="h-10 w-10 text-brand-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={refTypeIcons[ref.referenceType] || refTypeIcons.partner} />
                  </svg>
                  <div className="absolute top-3 right-3">
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-brand-600 shadow-sm">
                      {refTypeLabels[ref.referenceType] || ref.referenceType}
                    </span>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-5">
                <h3 className="font-semibold text-[var(--foreground)] group-hover:text-brand-600 transition-colors">
                  {ref.title}
                </h3>
                {ref.description && (
                  <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed line-clamp-3">
                    {ref.description}
                  </p>
                )}
                {ref.websiteUrl && (
                  <a
                    href={ref.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors"
                  >
                    Web sitesini ziyaret et
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="Henüz referans eklenmemiş." />
      )}

      {/* Stats bar */}
      {references.length > 0 && (
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {types.map((type) => {
            const count = references.filter((r) => r.referenceType === type).length;
            return (
              <div key={type} className="rounded-xl border border-[var(--border)] p-4 text-center">
                <p className="text-2xl font-bold text-brand-600">{count}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{refTypeLabels[type] || type}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
