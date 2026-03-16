'use client';

import { useState } from 'react';
import apiClient from '@/lib/api-client';

interface AppointmentFormProps {
  parcelId?: string;
  parcelTitle?: string;
  onClose: () => void;
}

export function AppointmentForm({ parcelId, parcelTitle, onClose }: AppointmentFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !date) return;
    setSubmitting(true);

    try {
      const message = [
        '--- RANDEVU TALEBİ ---',
        `Tarih: ${new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`,
        time ? `Saat: ${time}` : '',
        parcelTitle ? `İlan: ${parcelTitle}` : '',
        note ? `Not: ${note}` : '',
      ].filter(Boolean).join('\n');

      await apiClient.post('/crm/contact-requests', {
        type: 'general',
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        message,
        parcelId: parcelId || undefined,
      });
      setSuccess(true);
    } catch {
      alert('Randevu talebi gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--background)] border border-[var(--border)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[var(--foreground)]">Online Randevu Al</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </div>
            <h4 className="font-semibold text-[var(--foreground)]">Randevu Talebiniz Alındı</h4>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">En kısa sürede sizinle iletişime geçeceğiz.</p>
            <button onClick={onClose} className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
              Tamam
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {parcelTitle && (
              <div className="rounded-lg bg-[var(--muted)] p-3">
                <p className="text-xs text-[var(--muted-foreground)]">İlan</p>
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{parcelTitle}</p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Ad Soyad *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Telefon *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="05XX XXX XXXX"
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">E-posta</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Tarih *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Saat</label>
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Fark etmez</option>
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="12:00">12:00</option>
                  <option value="13:00">13:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                  <option value="17:00">17:00</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Not (opsiyonel)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Randevunuzla ilgili eklemek istediğiniz bilgi..."
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm resize-none focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !name.trim() || !phone.trim() || !date}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Gönderiliyor...
                </span>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                  Randevu Talep Et
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
