'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { PageHeader, Button } from '@/components/ui';
import type { Faq } from '@/types';

export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);

  // Form state
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchFaqs = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Faq[]>('/admin/faq');
      setFaqs(data);
    } catch (err) {
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFaqs(); }, [fetchFaqs]);

  function resetForm() {
    setQuestion('');
    setAnswer('');
    setCategory('');
    setSortOrder(0);
    setIsPublished(true);
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(faq: Faq) {
    setEditing(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setCategory(faq.category || '');
    setSortOrder(faq.sortOrder);
    setIsPublished(faq.isPublished);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!question || !answer) return;
    setSaving(true);
    try {
      const body = {
        question,
        answer,
        category: category || undefined,
        sortOrder,
        isPublished,
      };
      if (editing) {
        await apiClient.patch(`/admin/faq/${editing.id}`, body);
      } else {
        await apiClient.post('/admin/faq', body);
      }
      resetForm();
      fetchFaqs();
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu soruyu silmek istediğinize emin misiniz?')) return;
    try {
      await apiClient.delete(`/admin/faq/${id}`);
      fetchFaqs();
    } catch (err) {
      showApiError(err);
    }
  }

  async function handleTogglePublish(faq: Faq) {
    try {
      await apiClient.patch(`/admin/faq/${faq.id}`, { isPublished: !faq.isPublished });
      fetchFaqs();
    } catch (err) {
      showApiError(err);
    }
  }

  if (loading) return <TableSkeleton />;

  // Group by category
  const grouped: Record<string, Faq[]> = {};
  for (const faq of faqs) {
    const cat = faq.category || 'Genel';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(faq);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SSS Yönetimi"
        subtitle="Sıkça sorulan soruları yönetin"
      />

      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          + Yeni Soru
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--background)] p-6 shadow-xl">
            <h3 className="text-lg font-bold">{editing ? 'Soruyu Düzenle' : 'Yeni Soru'}</h3>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Soru *</label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cevap *</label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                  rows={4}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Kategori</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                    placeholder="Genel"
                  />
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
                <Button variant="secondary" type="button" onClick={resetForm}>
                  İptal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ List */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{cat}</h3>
          <div className="space-y-2">
            {items.map((faq) => (
              <div
                key={faq.id}
                className={`rounded-lg border p-4 transition-colors ${
                  faq.isPublished
                    ? 'border-[var(--border)] bg-[var(--background)]'
                    : 'border-yellow-200 bg-yellow-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{faq.question}</p>
                      {!faq.isPublished && (
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">Taslak</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)] line-clamp-2">{faq.answer}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePublish(faq)}
                      className={`rounded px-2 py-1 text-xs ${
                        faq.isPublished
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {faq.isPublished ? 'Gizle' : 'Yayınla'}
                    </button>
                    <button
                      onClick={() => startEdit(faq)}
                      className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-700 hover:bg-brand-100"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDelete(faq.id)}
                      className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {faqs.length === 0 && (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <p className="text-lg">Henüz soru eklenmemiş</p>
          <p className="text-sm mt-1">Yeni bir soru eklemek için yukarıdaki butona tıklayın</p>
        </div>
      )}
    </div>
  );
}
