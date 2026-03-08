'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { Button, PageHeader } from '@/components/ui';
import { BlockEditor, blocksToHtml, pageTemplates, type ContentBlock } from '@/components/block-editor';
import { CmsBlockRenderer } from '@/components/cms-block-renderer';

const pageTypes = [
  { value: 'about', label: 'Hakkımızda' },
  { value: 'vision', label: 'Vizyon' },
  { value: 'mission', label: 'Misyon' },
  { value: 'legal_info', label: 'Yasal Bilgiler' },
  { value: 'real_estate_concepts', label: 'Gayrimenkul Rehberi' },
  { value: 'withdrawal_info', label: 'Cayma Hakkı' },
  { value: 'post_sale', label: 'Satış Sonrası' },
  { value: 'press', label: 'Basın' },
  { value: 'custom', label: 'Özel Sayfa' },
];

export default function AdminNewPagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  const initialSlug = searchParams.get('slug') || '';
  const initialType = searchParams.get('type') || 'about';
  const initialTitle = searchParams.get('title') || '';

  const [form, setForm] = useState({
    pageType: initialType,
    slug: initialSlug,
    title: initialTitle,
    content: '',
    metaTitle: '',
    metaDescription: '',
    sortOrder: 0,
  });

  // Load template based on slug or type
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  useEffect(() => {
    const template = pageTemplates[initialSlug] || pageTemplates[initialType];
    if (template && blocks.length === 0) {
      setBlocks(template);
      setForm((prev) => ({ ...prev, content: blocksToHtml(template) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBlocksChange(updated: ContentBlock[]) {
    setBlocks(updated);
    setForm((prev) => ({ ...prev, content: blocksToHtml(updated) }));
  }

  function handleChange(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'title' && !form.slug) {
      const slug = (value as string)
        .toLowerCase()
        .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
      setForm((prev) => ({ ...prev, slug }));
    }
  }

  function loadTemplate() {
    const template = pageTemplates[form.slug] || pageTemplates[form.pageType];
    if (template) {
      if (blocks.length > 0 && !confirm('Mevcut içerik şablonla değiştirilecek. Devam?')) return;
      handleBlocksChange(template);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.slug || !form.pageType) return;
    setSaving(true);
    try {
      await apiClient.post('/admin/pages', {
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

  const hasTemplate = !!(pageTemplates[form.slug] || pageTemplates[form.pageType]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader title="Yeni Sayfa" subtitle="CMS sayfası oluşturun" />
        {hasTemplate && (
          <button
            type="button"
            onClick={loadTemplate}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
          >
            📋 Hazır Şablon Yükle
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Sayfa Bilgileri</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sayfa Türü *</label>
              <select
                value={form.pageType}
                onChange={(e) => handleChange('pageType', e.target.value)}
                className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {pageTypes.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
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

          <div>
            <label className="block text-sm font-medium mb-1">Başlık *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Sayfa başlığı"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">URL Slug *</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-[var(--muted-foreground)]">/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                className="flex-1 rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
                placeholder="sayfa-slug"
                required
              />
            </div>
          </div>
        </div>

        {/* Content */}
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
                  <p className="text-center text-sm text-[var(--muted-foreground)]">Henüz içerik eklenmedi.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SEO */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">SEO Ayarları</h2>

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

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            İptal
          </Button>
        </div>
      </form>
    </div>
  );
}
