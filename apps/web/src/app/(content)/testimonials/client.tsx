'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState } from '@/components/ui';
import type { Testimonial } from '@/types';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsContent() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<Testimonial[]>('/testimonials');
      setTestimonials(data);
    } catch {
      setError('Yorumlar yuklenirken bir hata olustu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState />;
  if (error) return <Alert className="mt-6">{error}</Alert>;

  // Calculate stats
  const avgRating = testimonials.length > 0
    ? (testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length).toFixed(1)
    : '0';
  const ratingDist = [5, 4, 3, 2, 1].map((r) => ({
    stars: r,
    count: testimonials.filter((t) => t.rating === r).length,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Müşteri Yorumları</h1>
      <p className="mt-2 text-sm text-gray-500">
        Musterilerimizin NetTapu deneyimleri ve memnuniyet degerlendirmeleri.
      </p>

      {testimonials.length > 0 && (
        <>
          {/* Rating summary */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="text-center sm:text-left">
                <p className="text-4xl font-bold text-gray-900">{avgRating}</p>
                <StarRating rating={Math.round(Number(avgRating))} />
                <p className="mt-1 text-sm text-gray-500">{testimonials.length} degerlendirme</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {ratingDist.map((r) => (
                  <div key={r.stars} className="flex items-center gap-2 text-sm">
                    <span className="w-12 text-right text-gray-600">{r.stars} yildiz</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-yellow-400"
                        style={{ width: `${testimonials.length > 0 ? (r.count / testimonials.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-gray-400">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Testimonials list */}
          <div className="mt-8 space-y-4">
            {testimonials.map((t) => (
              <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-start gap-4">
                  {t.photoUrl ? (
                    <img src={t.photoUrl} alt={t.name} className="h-12 w-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-600 shrink-0">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{t.name}</p>
                        {t.title && <p className="text-xs text-gray-500">{t.title}</p>}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(t.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <div className="mt-1">
                      <StarRating rating={t.rating} />
                    </div>
                    <p className="mt-3 text-sm text-gray-700 leading-relaxed">{t.comment}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {testimonials.length === 0 && (
        <div className="mt-8">
          <EmptyState message="Henuz musteri yorumu eklenmemis." />
        </div>
      )}
    </div>
  );
}
