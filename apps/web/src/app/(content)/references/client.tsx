'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState, Card } from '@/components/ui';
import type { Reference } from '@/types';

export function ReferencesContent() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReferences = useCallback(async () => {
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
    fetchReferences();
  }, [fetchReferences]);

  if (loading) return <LoadingState />;
  if (error) return <Alert className="mt-6">{error}</Alert>;
  if (references.length === 0) return <EmptyState message="Henüz referans eklenmemiş." />;

  return (
    <div>
      <h1 className="text-3xl font-bold">Referanslar</h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {references.map((ref) => (
          <Card key={ref.id}>
            {ref.imageUrl && (
              <img
                src={ref.imageUrl}
                alt={ref.title}
                className="mb-4 h-40 w-full rounded object-cover"
              />
            )}
            <h3 className="font-semibold">{ref.title}</h3>
            {ref.description && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {ref.description}
              </p>
            )}
            {ref.websiteUrl && (
              <a
                href={ref.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline"
              >
                Web sitesini ziyaret et
              </a>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
