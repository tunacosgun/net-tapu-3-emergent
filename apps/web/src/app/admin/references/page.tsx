'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { PageHeader, Button } from '@/components/ui';
import type { Reference } from '@/types';

const refTypeLabels: Record<string, string> = {
  partner: 'İş Ortağı',
  project: 'Tamamlanan Proje',
  media: 'Medya',
  certification: 'Sertifika',
};

export default function AdminReferencesPage() {
  const [refs, setRefs] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reference | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [referenceType, setReferenceType] = useState('partner');
  const [sortOrder, setSortOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRefs = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Reference[]>('/admin/references');
      setRefs(data);
    } catch (err) {
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRefs(); }, [fetchRefs]);

  function resetForm() {
    setTitle('');
    setDescription('');
    setImageUrl('');
    setWebsiteUrl('');
    setReferenceType('partner');
    setSortOrder(0);
    setIsPublished(true);
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(ref: Reference) {
    setEditing(ref);
    setTitle(ref.title);
    setDescription(ref.description || '');
    setImageUrl(ref.imageUrl || '');
    setWebsiteUrl(ref.websiteUrl || '');
    setReferenceType(ref.referenceType);
    setSortOrder(ref.sortOrder);
    setIsPublished(ref.isPublished);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !referenceType) return;
    setSaving(true);
    try {
      const body = {
        title,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        websiteUrl: websiteUrl || undefined,
        referenceType,
        sortOrder,
        isPublished,
      };
      if (editing) {
        await apiClient.patch(`/admin/references/${editing.id}`, body);
      } else {
        await apiClient.post('/admin/references', body);
      }
      resetForm();
      fetchRefs();
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu referansı silmek istediğinize emin misiniz?')) return;
    try {
      await apiClient.delete(`/admin/references/${id}`);
      fetchRefs();
    } catch (err) {
      showApiError(err);
    }
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Referanslar" subtitle="İş ortakları ve referansları yönetin" />

      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowForm(true); }}>+ Yeni Referans</Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--background)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">{editing ? 'Referans Düzenle' : 'Yeni Referans'}</h3>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Başlık *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Açıklama</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tür *</label>
                  <select
                    value={referenceType}
                    onChange={(e) => setReferenceType(e.target.value)}
                    className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    {Object.entries(refTypeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sıra</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                    className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resim URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Website URL</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded"
                />
                Yayınla
              </label>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
                </Button>
                <Button variant="secondary" type="button" onClick={resetForm}>İptal</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reference Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {refs.map((ref) => (
          <div
            key={ref.id}
            className={`rounded-xl border p-4 transition-colors ${
              ref.isPublished ? 'border-[var(--border)] bg-[var(--background)]' : 'border-yellow-200 bg-yellow-50/50'
            }`}
          >
            {ref.imageUrl && (
              <img
                src={ref.imageUrl}
                alt={ref.title}
                className="mb-3 h-20 w-full rounded-lg object-contain bg-[var(--muted)]"
              />
            )}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{ref.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {refTypeLabels[ref.referenceType] || ref.referenceType}
                </p>
              </div>
              {!ref.isPublished && (
                <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">Taslak</span>
              )}
            </div>
            {ref.description && (
              <p className="mt-2 text-xs text-[var(--muted-foreground)] line-clamp-2">{ref.description}</p>
            )}
            <div className="mt-3 flex gap-1">
              <button onClick={() => startEdit(ref)} className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-700 hover:bg-brand-100">
                Düzenle
              </button>
              <button onClick={() => handleDelete(ref.id)} className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>

      {refs.length === 0 && (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <p className="text-lg">Henüz referans eklenmemiş</p>
        </div>
      )}
    </div>
  );
}
