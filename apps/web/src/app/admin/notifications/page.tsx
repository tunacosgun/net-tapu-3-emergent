'use client';

import { useState } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { PageHeader, Card, Button, Alert } from '@/components/ui';

type Channel = 'email' | 'sms' | 'push';
type AudienceType = 'all' | 'verified' | 'specific';

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<Set<Channel>>(new Set(['email']));
  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [specificEmail, setSpecificEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  function toggleChannel(ch: Channel) {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !body || channels.size === 0) return;
    setSending(true);
    setSuccess(false);
    try {
      await apiClient.post('/admin/notifications/broadcast', {
        title,
        body,
        channels: [...channels],
        audience: audienceType,
        specificEmail: audienceType === 'specific' ? specificEmail : undefined,
      });
      setSuccess(true);
      setTitle('');
      setBody('');
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      showApiError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bildirim Gönder"
        subtitle="Kullanıcılara toplu veya bireysel bildirim gönderin"
      />

      {success && (
        <Alert variant="success">Bildirim başarıyla gönderildi.</Alert>
      )}

      <Card className="p-6">
        <form onSubmit={handleSend} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium">Başlık</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bildirim başlığı"
              className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium">İçerik</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bildirim içeriği..."
              rows={5}
              className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
              required
            />
          </div>

          {/* Channels */}
          <div>
            <label className="block text-sm font-medium mb-2">Kanallar</label>
            <div className="flex gap-3">
              {([
                { key: 'email' as Channel, label: 'E-posta', icon: '📧' },
                { key: 'sms' as Channel, label: 'SMS', icon: '📱' },
                { key: 'push' as Channel, label: 'Push Bildirim', icon: '🔔' },
              ]).map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => toggleChannel(ch.key)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                    channels.has(ch.key)
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-brand-300'
                  }`}
                >
                  <span>{ch.icon}</span>
                  <span>{ch.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium mb-2">Hedef Kitle</label>
            <div className="space-y-2">
              {([
                { key: 'all' as AudienceType, label: 'Tüm Kullanıcılar', desc: 'Tüm kayıtlı kullanıcılara gönder' },
                { key: 'verified' as AudienceType, label: 'Doğrulanmış Kullanıcılar', desc: 'Sadece e-postası doğrulanmış kullanıcılara' },
                { key: 'specific' as AudienceType, label: 'Belirli Kullanıcı', desc: 'Tek bir kullanıcıya gönder' },
              ]).map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    audienceType === opt.key
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-[var(--border)] hover:border-brand-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="audience"
                    value={opt.key}
                    checked={audienceType === opt.key}
                    onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">{opt.label}</span>
                    <p className="text-xs text-[var(--muted-foreground)]">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {audienceType === 'specific' && (
              <input
                type="email"
                value={specificEmail}
                onChange={(e) => setSpecificEmail(e.target.value)}
                placeholder="kullanici@ornek.com"
                className="mt-3 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
                required
              />
            )}
          </div>

          {/* Preview */}
          {title && (
            <Card className="p-4 bg-[var(--muted)]">
              <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase">Önizleme</p>
              <p className="mt-2 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">
                {body}
              </p>
              <div className="mt-2 flex gap-2">
                {[...channels].map((ch) => (
                  <span
                    key={ch}
                    className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                  >
                    {ch === 'email' ? '📧 E-posta' : ch === 'sms' ? '📱 SMS' : '🔔 Push'}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={sending || channels.size === 0}>
              {sending ? 'Gönderiliyor...' : 'Bildirimi Gönder'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
