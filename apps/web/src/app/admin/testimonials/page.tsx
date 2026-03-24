'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { PageHeader, Button } from '@/components/ui';
import type { Testimonial } from '@/types';

export default function AdminTestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Testimonial[]>('/admin/testimonials');
      setItems(data);
    } catch (err) {
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function resetForm() {
    setName('');
    setTitle('');
    setComment('');
    setRating(5);
    setPhotoUrl('');
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(t: Testimonial) {
    setEditing(t);
    setName(t.name);
    setTitle(t.title || '');
    setComment(t.comment);
    setRating(t.rating);
    setPhotoUrl(t.photoUrl || '');
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !comment) return;
    setSaving(true);
    try {
      const body = {
        name,
        title: title || undefined,
        comment,
        rating,
        photoUrl: photoUrl || undefined,
      };
      if (editing) {
        await apiClient.patch(`/admin/testimonials/${editing.id}`, body);
      } else {
        await apiClient.post('/admin/testimonials', body);
      }
      resetForm();
      fetchData();
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await apiClient.patch(`/admin/testimonials/${id}/approve`);
      fetchData();
    } catch (err) {
      showApiError(err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu yorumu silmek istediğinize emin misiniz?')) return;
    try {
      await apiClient.delete(`/admin/testimonials/${id}`);
      fetchData();
    } catch (err) {
      showApiError(err);
    }
  }

  function renderStars(count: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < count ? 'text-yellow-400' : 'text-gray-300'}>
        &#9733;
      </span>
    ));
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Müşteri Yorumları" subtitle="Müşteri memnuniyet yorumlarını yönetin" />


      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowForm(true); }}>+ Yeni Yorum</Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">{editing ? 'Yorum Düzenle' : 'Yeni Yorum'}</h3>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Adı *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unvan / Konum</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Örn: İstanbul, Yatırımcı"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yorum *</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows={4}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puan *</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>{r} Yıldız</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Foto URL</label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>
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

      {/* Testimonials List */}
      <div className="space-y-3">
        {items.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border p-4 ${
              t.isApproved ? 'border-gray-200 bg-white' : 'border-yellow-200 bg-yellow-50'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                {t.photoUrl ? (
                  <img src={t.photoUrl} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900">{t.name}</p>
                    {t.title && <span className="text-xs text-gray-500">- {t.title}</span>}
                  </div>
                  <div className="mt-0.5 text-sm">{renderStars(t.rating)}</div>
                  <p className="mt-1 text-sm text-gray-600">{t.comment}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!t.isApproved && (
                  <button onClick={() => handleApprove(t.id)} className="rounded bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100">
                    Onayla
                  </button>
                )}
                {t.isApproved && (
                  <span className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">Onaylanmış</span>
                )}
                <button onClick={() => startEdit(t)} className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-700 hover:bg-brand-100">
                  Düzenle
                </button>
                <button onClick={() => handleDelete(t.id)} className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                  Sil
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Henüz müşteri yorumu eklenmemiş</p>
        </div>
      )}
    </div>
  );
}
