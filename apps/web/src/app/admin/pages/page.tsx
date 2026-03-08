'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatDate } from '@/lib/format';
import { PageHeader, Button } from '@/components/ui';
import type { CmsPage, PaginatedResponse } from '@/types';

/* ── Page type definitions with icons and colors ── */
const contentPages = [
  { slug: 'about', type: 'about', label: 'Hakkımızda', icon: '🏢', color: 'from-brand-500 to-emerald-500', publicPath: '/about' },
  { slug: 'vision', type: 'vision', label: 'Vizyon', icon: '👁️', color: 'from-indigo-500 to-violet-500', publicPath: '/vision' },
  { slug: 'mission', type: 'mission', label: 'Misyon', icon: '🛡️', color: 'from-emerald-500 to-teal-500', publicPath: '/mission' },
  { slug: 'how-it-works', type: 'custom', label: 'Nasıl Çalışırız', icon: '⚙️', color: 'from-brand-500 to-brand-600', publicPath: '/how-it-works' },
  { slug: 'press', type: 'press', label: 'Basın', icon: '📰', color: 'from-slate-600 to-slate-800', publicPath: '/press' },
  { slug: 'real-estate-guide', type: 'real_estate_concepts', label: 'Gayrimenkul Rehberi', icon: '📖', color: 'from-amber-500 to-orange-500', publicPath: '/real-estate-guide' },
];

const legalPages = [
  { slug: 'legal', type: 'legal_info', label: 'Yasal Bilgiler', icon: '⚖️', color: 'from-slate-600 to-slate-700', publicPath: '/legal' },
  { slug: 'withdrawal-rights', type: 'withdrawal_info', label: 'Cayma Hakkı', icon: '↩️', color: 'from-slate-500 to-slate-700', publicPath: '/withdrawal-rights' },
];

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  published: { label: 'Yayında', dot: 'bg-green-500', bg: 'bg-green-50 text-green-700 border-green-200' },
  draft: { label: 'Taslak', dot: 'bg-yellow-500', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  archived: { label: 'Arşiv', dot: 'bg-gray-400', bg: 'bg-gray-50 text-gray-500 border-gray-200' },
};

export default function AdminPagesPage() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const fetchPages = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get<PaginatedResponse<CmsPage>>('/admin/pages', {
        params: { limit: 100 },
      });
      setPages(res.data);
    } catch (err) {
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  async function handleTogglePublish(id: string, currentStatus: string) {
    try {
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      await apiClient.patch(`/admin/pages/${id}`, { status: newStatus });
      fetchPages();
    } catch (err) {
      showApiError(err);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" sayfasını silmek istediğinize emin misiniz?`)) return;
    try {
      await apiClient.delete(`/admin/pages/${id}`);
      fetchPages();
    } catch (err) {
      showApiError(err);
    }
  }

  // Match DB pages to our content page definitions
  function findDbPage(slug: string): CmsPage | undefined {
    return pages.find((p) => p.slug === slug);
  }

  if (loading) return <TableSkeleton />;

  const publishedCount = pages.filter((p) => p.status === 'published').length;
  const draftCount = pages.filter((p) => p.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="İçerik Yönetimi"
          subtitle="Tüm site sayfalarını tek yerden yönetin"
        />
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
            <button
              onClick={() => setView('cards')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'cards' ? 'bg-[var(--background)] shadow-sm text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
              }`}
            >
              Kartlar
            </button>
            <button
              onClick={() => setView('table')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'table' ? 'bg-[var(--background)] shadow-sm text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
              }`}
            >
              Tablo
            </button>
          </div>
          <Link href="/admin/pages/new">
            <Button>+ Yeni Sayfa</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--foreground)]">{pages.length}</p>
          <p className="text-xs text-[var(--muted-foreground)]">Toplam Sayfa</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
          <p className="text-xs text-green-600">Yayında</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{draftCount}</p>
          <p className="text-xs text-yellow-600">Taslak</p>
        </div>
      </div>

      {view === 'cards' ? (
        <>
          {/* Main Content Pages */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
              Kurumsal Sayfalar
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contentPages.map((cp) => {
                const dbPage = findDbPage(cp.slug);
                return (
                  <ContentPageCard
                    key={cp.slug}
                    config={cp}
                    dbPage={dbPage}
                    onTogglePublish={handleTogglePublish}
                  />
                );
              })}
            </div>
          </div>

          {/* Legal Pages */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
              Yasal Sayfalar
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {legalPages.map((cp) => {
                const dbPage = findDbPage(cp.slug);
                return (
                  <ContentPageCard
                    key={cp.slug}
                    config={cp}
                    dbPage={dbPage}
                    onTogglePublish={handleTogglePublish}
                  />
                );
              })}
            </div>
          </div>

          {/* Dynamic Content */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
              Dinamik İçerik
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link href="/admin/faq" className="group rounded-xl border border-[var(--border)] p-5 transition-all hover:shadow-md hover:border-brand-200">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">❓</span>
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] group-hover:text-brand-600 transition-colors">S.S.S.</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Sıkça sorulan soruları yönetin</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-brand-500 font-medium">
                  Yönet
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              <Link href="/admin/references" className="group rounded-xl border border-[var(--border)] p-5 transition-all hover:shadow-md hover:border-brand-200">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] group-hover:text-brand-600 transition-colors">Referanslar</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">İş ortakları ve projeler</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-brand-500 font-medium">
                  Yönet
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              <Link href="/admin/pages/new" className="group rounded-xl border border-dashed border-[var(--border)] p-5 transition-all hover:shadow-md hover:border-brand-300 flex flex-col items-center justify-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 text-xl font-bold mb-2">+</div>
                <h3 className="text-sm font-semibold text-[var(--muted-foreground)] group-hover:text-brand-600 transition-colors">Özel Sayfa Ekle</h3>
              </Link>
            </div>
          </div>

          {/* Other pages not in our predefined list */}
          {(() => {
            const knownSlugs = [...contentPages, ...legalPages].map((p) => p.slug);
            const otherPages = pages.filter((p) => !knownSlugs.includes(p.slug));
            if (otherPages.length === 0) return null;
            return (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                  Diğer Sayfalar
                </h2>
                <div className="space-y-2">
                  {otherPages.map((p) => {
                    const st = statusConfig[p.status] || statusConfig.draft;
                    return (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${st.dot}`} />
                          <div>
                            <span className="text-sm font-medium">{p.title}</span>
                            <span className="ml-2 text-xs text-[var(--muted-foreground)]">/{p.slug}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleTogglePublish(p.id, p.status)}
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              p.status === 'published' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {p.status === 'published' ? 'Geri Al' : 'Yayınla'}
                          </button>
                          <Link href={`/admin/pages/${p.id}`} className="rounded bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                            Düzenle
                          </Link>
                          <button onClick={() => handleDelete(p.id, p.title)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
                            Sil
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        /* Table View */
        <TableView pages={pages} onTogglePublish={handleTogglePublish} onDelete={handleDelete} />
      )}
    </div>
  );
}

/* ── Card Component ── */
interface ContentPageCardProps {
  config: { slug: string; type: string; label: string; icon: string; color: string; publicPath: string };
  dbPage?: CmsPage;
  onTogglePublish: (id: string, status: string) => void;
}

function ContentPageCard({ config, dbPage, onTogglePublish }: ContentPageCardProps) {
  const st = dbPage ? (statusConfig[dbPage.status] || statusConfig.draft) : null;

  return (
    <div className="group rounded-xl border border-[var(--border)] overflow-hidden transition-all hover:shadow-md hover:border-brand-200">
      {/* Color header */}
      <div className={`bg-gradient-to-r ${config.color} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <h3 className="text-sm font-semibold text-white">{config.label}</h3>
        </div>
        {st && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.bg}`}>
            {st.label}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        {dbPage ? (
          <>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span>/{dbPage.slug}</span>
              {dbPage.updatedAt && (
                <>
                  <span>·</span>
                  <span>{formatDate(dbPage.updatedAt, 'date')}</span>
                </>
              )}
            </div>
            <div className="flex gap-1.5">
              <Link
                href={`/admin/pages/${dbPage.id}`}
                className="flex-1 rounded-md bg-brand-50 py-1.5 text-center text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
              >
                Düzenle
              </Link>
              <button
                onClick={() => onTogglePublish(dbPage.id, dbPage.status)}
                className={`flex-1 rounded-md py-1.5 text-center text-xs font-medium transition-colors ${
                  dbPage.status === 'published'
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {dbPage.status === 'published' ? 'Geri Al' : 'Yayınla'}
              </button>
              <Link
                href={config.publicPath}
                target="_blank"
                className="rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                title="Önizle"
              >
                ↗
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-[var(--muted-foreground)] mb-2">Henüz içerik eklenmedi</p>
            <Link
              href={`/admin/pages/new?type=${config.type}&slug=${config.slug}&title=${encodeURIComponent(config.label)}`}
              className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
            >
              + İçerik Oluştur
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Table View (classic) ── */
function TableView({
  pages,
  onTogglePublish,
  onDelete,
}: {
  pages: CmsPage[];
  onTogglePublish: (id: string, status: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const pageTypeLabels: Record<string, string> = {
    about: 'Hakkımızda', vision: 'Vizyon', mission: 'Misyon',
    legal_info: 'Yasal Bilgiler', real_estate_concepts: 'Gayrimenkul Rehberi',
    withdrawal_info: 'Cayma Hakkı', post_sale: 'Satış Sonrası', press: 'Basın', custom: 'Özel Sayfa',
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--muted)] text-left">
            <th className="px-4 py-3 font-semibold">Başlık</th>
            <th className="px-4 py-3 font-semibold">Tür</th>
            <th className="px-4 py-3 font-semibold">Durum</th>
            <th className="px-4 py-3 font-semibold">Tarih</th>
            <th className="px-4 py-3 font-semibold text-right">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => {
            const st = statusConfig[p.status] || statusConfig.draft;
            return (
              <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--muted)]/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/admin/pages/${p.id}`} className="font-medium hover:text-brand-500 transition-colors">
                    {p.title}
                  </Link>
                  <p className="text-xs text-[var(--muted-foreground)]">/{p.slug}</p>
                </td>
                <td className="px-4 py-3 text-xs">{pageTypeLabels[p.pageType] || p.pageType}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                  {p.publishedAt ? formatDate(p.publishedAt, 'date') : formatDate(p.createdAt, 'date')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onTogglePublish(p.id, p.status)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        p.status === 'published' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {p.status === 'published' ? 'Geri Al' : 'Yayınla'}
                    </button>
                    <Link href={`/admin/pages/${p.id}`} className="rounded bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
                      Düzenle
                    </Link>
                    <button onClick={() => onDelete(p.id, p.title)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100">
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {pages.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                Henüz sayfa eklenmemiş.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
