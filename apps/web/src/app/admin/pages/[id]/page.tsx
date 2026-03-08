'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { Button, PageHeader } from '@/components/ui';
import { BlockEditor, blocksToHtml, htmlToBlocks, pageTemplates, type ContentBlock } from '@/components/block-editor';
import { CmsBlockRenderer } from '@/components/cms-block-renderer';
import type { CmsPage } from '@/types';

const pageTypeLabels: Record<string, string> = {
  about: 'Hakkımızda',
  vision: 'Vizyon',
  mission: 'Misyon',
  legal_info: 'Yasal Bilgiler',
  real_estate_concepts: 'Gayrimenkul Rehberi',
  withdrawal_info: 'Cayma Hakkı',
  post_sale: 'Satış Sonrası',
  press: 'Basın',
  custom: 'Özel Sayfa',
};

export default function AdminEditPagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPageData] = useState<CmsPage | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  const [form, setForm] = useState({
    title: '',
    content: '',
    metaTitle: '',
    metaDescription: '',
    sortOrder: 0,
    status: 'draft',
  });

  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  useEffect(() => {
    async function fetchPage() {
      try {
        const { data } = await apiClient.get<CmsPage>(`/admin/pages/${params.id}`);
        setPageData(data);
        setForm({
          title: data.title,
          content: data.content || '',
          metaTitle: data.metaTitle || '',
          metaDescription: data.metaDescription || '',
          sortOrder: data.sortOrder,
          status: data.status,
        });
        // Parse existing content into blocks
        if (data.content) {
          setBlocks(htmlToBlocks(data.content));
        } else {
          // Load template for this page type if available
          const template = pageTemplates[data.slug] || pageTemplates[data.pageType];
          if (template) {
            setBlocks(template);
          }
        }
      } catch (err) {
        showApiError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPage();
  }, [params.id]);

  function handleBlocksChange(updated: ContentBlock[]) {
    setBlocks(updated);
    setForm((prev) => ({ ...prev, content: blocksToHtml(updated) }));
  }

  function handleChange(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch(`/admin/pages/${params.id}`, {
        ...form,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
      });
      router.push('/admin/pages');
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    try {
      // Also save content when publishing
      await apiClient.patch(`/admin/pages/${params.id}`, {
        ...form,
        status: 'published',
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
      });
      setForm((prev) => ({ ...prev, status: 'published' }));
      setPageData((prev) => prev ? { ...prev, status: 'published' } : prev);
    } catch (err) {
      showApiError(err);
    }
  }

  async function handleUnpublish() {
    try {
      await apiClient.patch(`/admin/pages/${params.id}`, { status: 'draft' });
      setForm((prev) => ({ ...prev, status: 'draft' }));
      setPageData((prev) => prev ? { ...prev, status: 'draft' } : prev);
    } catch (err) {
      showApiError(err);
    }
  }

  function loadTemplate() {
    if (!page) return;
    const template = pageTemplates[page.slug] || pageTemplates[page.pageType];
    if (template) {
      if (blocks.length > 0 && !confirm('Mevcut içerik şablonla değiştirilecek. Devam etmek istiyor musunuz?')) return;
      handleBlocksChange(template);
    }
  }

  if (loading) return <TableSkeleton />;
  if (!page) return <p className="text-red-600">Sayfa bulunamadı.</p>;

  const hasTemplate = !!(pageTemplates[page.slug] || pageTemplates[page.pageType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title={page.title}
          subtitle={`${pageTypeLabels[page.pageType] || page.pageType} — /${page.slug}`}
        />
        <div className="flex gap-2 shrink-0 flex-wrap">
          {hasTemplate && (
            <button
              type="button"
              onClick={loadTemplate}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              📋 Şablon Yükle
            </button>
          )}
          {form.status === 'published' ? (
            <button
              onClick={handleUnpublish}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
            >
              Yayından Kaldır
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              Kaydet & Yayınla
            </button>
          )}
          <Link
            href={`/${page.slug}`}
            target="_blank"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
          >
            Önizle ↗
          </Link>
        </div>
      </div>

      {/* Status */}
      <div className={`rounded-lg px-4 py-2 text-sm flex items-center justify-between ${
        form.status === 'published'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
      }`}>
        <span>{form.status === 'published' ? '✅ Bu sayfa yayında' : '⏳ Bu sayfa taslak durumunda'}</span>
        <span className="text-xs">{blocks.length} blok</span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Sayfa Bilgileri</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Başlık *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sıra No</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => handleChange('sortOrder', parseInt(e.target.value) || 0)}
                className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Content — Editor / Preview tabs */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--muted)] px-4 py-2">
            <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">İçerik</h2>
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  activeTab === 'editor' ? 'bg-brand-500 text-white shadow-sm' : 'text-[var(--muted-foreground)]'
                }`}
              >
                ✏️ Düzenle
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  activeTab === 'preview' ? 'bg-brand-500 text-white shadow-sm' : 'text-[var(--muted-foreground)]'
                }`}
              >
                👁️ Önizleme
              </button>
            </div>
          </div>

          <div className="p-4">
            {activeTab === 'editor' ? (
              <BlockEditor blocks={blocks} onChange={handleBlocksChange} />
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-6 bg-white">
                {blocks.length > 0 ? (
                  <CmsBlockRenderer blocks={blocks} />
                ) : (
                  <p className="text-center text-sm text-[var(--muted-foreground)]">Henüz içerik eklenmedi. Düzenle sekmesinden blok ekleyin.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SEO */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">SEO Ayarları</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Meta Başlık</label>
              <input
                type="text"
                value={form.metaTitle}
                onChange={(e) => handleChange('metaTitle', e.target.value)}
                className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="Arama motorlarında görünecek başlık"
                maxLength={200}
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{form.metaTitle.length}/200</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meta Açıklama</label>
              <textarea
                value={form.metaDescription}
                onChange={(e) => handleChange('metaDescription', e.target.value)}
                className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                rows={3}
                placeholder="Arama motorlarında görünecek açıklama"
                maxLength={500}
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{form.metaDescription.length}/500</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.push('/admin/pages')}>
            Geri Dön
          </Button>
        </div>
      </form>
    </div>
  );
}
