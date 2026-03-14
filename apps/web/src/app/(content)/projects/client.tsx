'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { LoadingState, Alert, EmptyState } from '@/components/ui';
import type { Reference } from '@/types';

export function ProjectsContent() {
  const [projects, setProjects] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<Reference[]>('/content/references');
      // Filter only project-type references
      setProjects(
        data.filter(
          (r) => r.referenceType === 'project' || r.referenceType === 'completed_project',
        ),
      );
    } catch {
      setError('Projeler yuklenirken bir hata olustu.');
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
      <h1 className="text-2xl font-bold text-gray-900">Tamamlanan Projelerimiz</h1>
      <p className="mt-2 text-sm text-gray-500">
        NetTapu araciligiyla basariyla tamamlanan gayrimenkul projeleri ve arsa satislari.
      </p>

      {/* Stats bar */}
      {projects.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">{projects.length}</p>
            <p className="mt-1 text-xs text-gray-500">Tamamlanan Proje</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">
              {projects.filter((p) => p.imageUrl).length}
            </p>
            <p className="mt-1 text-xs text-gray-500">Gorselli Proje</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">
              {projects.filter((p) => p.websiteUrl).length}
            </p>
            <p className="mt-1 text-xs text-gray-500">Detayli Bilgi</p>
          </div>
        </div>
      )}

      {/* Projects grid */}
      {projects.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
            >
              {project.imageUrl && (
                <div className="h-48 bg-gray-100">
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="p-5">
                <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
                {project.description && (
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    {project.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <span className="inline-block rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    Tamamlandi
                  </span>
                  {project.websiteUrl && (
                    <a
                      href={project.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-500 hover:underline"
                    >
                      Detaylar
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState message="Henuz tamamlanan proje eklenmemis." />
          <div className="mt-6 text-center">
            <Link
              href="/parcels"
              className="inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              Mevcut Arsalari Incele
            </Link>
          </div>
        </div>
      )}

      {/* CTA */}
      {projects.length > 0 && (
        <div className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900">Siz de Yatirim Yapin</h2>
          <p className="mt-1 text-sm text-gray-500">
            Arsalari inceleyin veya canli ihaleye katilarak uygun fiyata arsa edinin.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/parcels"
              className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              Arsalari Incele
            </Link>
            <Link
              href="/auctions"
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-white transition-colors"
            >
              Ihalelere Katil
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
