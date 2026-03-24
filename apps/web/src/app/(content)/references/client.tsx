'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState } from '@/components/ui';
import type { Reference } from '@/types';

const refTypeLabels: Record<string, string> = {
  partner: 'İş Ortağı',
  completed_project: 'Tamamlanan Proje',
  project: 'Tamamlanan Proje',
  testimonial: 'Müşteri Yorumu',
  media: 'Medya',
  certification: 'Sertifika',
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

  const types = Array.from(new Set(references.map((r) => r.referenceType)));
  const filtered = activeType
    ? references.filter((r) => r.referenceType === activeType)
    : references;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Referanslarımız</h1>
      <p className="mt-2 text-sm text-gray-500">
        İş ortaklarımız ve başarılı projelerimiz
      </p>

      {/* Type filter tabs */}
      {types.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveType(null)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeType === null
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tümü ({references.length})
          </button>
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeType === type
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {refTypeLabels[type] || type} ({references.filter((r) => r.referenceType === type).length})
            </button>
          ))}
        </div>
      )}

      {/* References Grid */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ref) => (
            <div
              key={ref.id}
              className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              {ref.imageUrl && (
                <div className="mb-4 flex items-center justify-center rounded-md bg-gray-50 p-4">
                  <img
                    src={ref.imageUrl}
                    alt={ref.title}
                    className="h-16 max-w-full object-contain"
                  />
                </div>
              )}
              <h3 className="font-semibold text-gray-900">{ref.title}</h3>
              <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {refTypeLabels[ref.referenceType] || ref.referenceType}
              </span>
              {ref.description && (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3">{ref.description}</p>
              )}
              {ref.websiteUrl && (
                <a
                  href={ref.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-brand-500 hover:underline"
                >
                  Web sitesini ziyaret et
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="Henüz referans eklenmemiş." />
      )}

      {/* Stats */}
      {references.length > 0 && types.length > 1 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {types.map((type) => {
            const count = references.filter((r) => r.referenceType === type).length;
            return (
              <div key={type} className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-brand-600">{count}</p>
                <p className="mt-1 text-xs text-gray-500">{refTypeLabels[type] || type}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
