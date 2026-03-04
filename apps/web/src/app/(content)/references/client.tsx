'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState, Card } from '@/components/ui';
import type { Reference } from '@/types';

interface Testimonial {
  id: string;
  name: string;
  title: string | null;
  comment: string;
  rating: number;
  photoUrl: string | null;
  videoUrl: string | null;
}

export function ReferencesContent() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [refsRes, testimonialsRes] = await Promise.all([
        apiClient.get<Reference[]>('/content/references'),
        apiClient.get<Testimonial[]>('/testimonials').catch(() => ({ data: [] as Testimonial[] })),
      ]);
      setReferences(refsRes.data);
      setTestimonials(testimonialsRes.data);
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

  return (
    <div>
      <h1 className="text-3xl font-bold">Referanslar</h1>

      {/* Customer Testimonials Section */}
      {testimonials.length > 0 && (
        <div className="mt-10">
          <h2 className="text-2xl font-bold">Müşteri Yorumları</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Müşterilerimizin NetTapu deneyimleri
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-[var(--border)] p-6 relative"
              >
                {/* Quote icon */}
                <span className="text-4xl text-brand-200 absolute top-4 right-6">&ldquo;</span>

                <div className="flex items-center gap-3">
                  {t.photoUrl ? (
                    <img
                      src={t.photoUrl}
                      alt={t.name}
                      className="h-12 w-12 rounded-full object-cover border-2 border-brand-200"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg">
                      {t.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    {t.title && (
                      <p className="text-xs text-[var(--muted-foreground)]">{t.title}</p>
                    )}
                  </div>
                </div>

                {/* Star Rating */}
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`text-sm ${i < t.rating ? 'text-yellow-400' : 'text-gray-200'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
                  {t.comment}
                </p>

                {t.videoUrl && (
                  <a
                    href={t.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
                  >
                    🎥 Video yorumu izle
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Business References Section */}
      {references.length > 0 ? (
        <div className="mt-12">
          <h2 className="text-2xl font-bold">İş Ortaklarımız</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      ) : (
        <EmptyState message="Henüz referans eklenmemiş." />
      )}
    </div>
  );
}
