'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { PageHeader, Card, Button, Alert, LoadingState } from '@/components/ui';

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

const SETTING_GROUPS: { title: string; keys: { key: string; label: string; type: 'text' | 'textarea' | 'email' | 'tel' | 'url' }[] }[] = [
  {
    title: 'Genel',
    keys: [
      { key: 'site_title', label: 'Site Başlığı', type: 'text' },
      { key: 'site_description', label: 'Site Açıklaması', type: 'textarea' },
      { key: 'default_currency', label: 'Varsayılan Para Birimi', type: 'text' },
    ],
  },
  {
    title: 'İletişim',
    keys: [
      { key: 'contact_phone', label: 'Telefon', type: 'tel' },
      { key: 'contact_email', label: 'E-posta', type: 'email' },
      { key: 'whatsapp_number', label: 'WhatsApp Numarası', type: 'tel' },
      { key: 'address', label: 'Adres', type: 'textarea' },
    ],
  },
  {
    title: 'Sosyal Medya',
    keys: [
      { key: 'social_facebook', label: 'Facebook URL', type: 'url' },
      { key: 'social_twitter', label: 'Twitter / X URL', type: 'url' },
      { key: 'social_instagram', label: 'Instagram URL', type: 'url' },
      { key: 'social_linkedin', label: 'LinkedIn URL', type: 'url' },
      { key: 'social_youtube', label: 'YouTube URL', type: 'url' },
    ],
  },
  {
    title: 'SEO',
    keys: [
      { key: 'seo_meta_title', label: 'Meta Başlık', type: 'text' },
      { key: 'seo_meta_description', label: 'Meta Açıklama', type: 'textarea' },
      { key: 'google_analytics_id', label: 'Google Analytics ID', type: 'text' },
    ],
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    apiClient
      .get<SystemSetting[]>('/admin/settings')
      .then(({ data }) => {
        const map: Record<string, string> = {};
        if (Array.isArray(data)) {
          data.forEach((s) => {
            map[s.key] = s.value;
          });
        }
        setSettings(map);
      })
      .catch(() => {
        // Endpoint may not exist yet
      })
      .finally(() => setLoading(false));
  }, []);

  function updateSetting(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setSuccess(false);
    try {
      await apiClient.patch('/admin/settings', { settings });
      setSuccess(true);
      setDirty(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistem Ayarları"
        subtitle="Platform genelindeki ayarları yönetin"
        action={
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </Button>
        }
      />

      {success && (
        <Alert variant="success">Ayarlar başarıyla kaydedildi.</Alert>
      )}

      {SETTING_GROUPS.map((group) => (
        <Card key={group.title} className="p-6">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <div className="mt-4 space-y-4">
            {group.keys.map((setting) => (
              <div key={setting.key}>
                <label className="block text-sm font-medium">{setting.label}</label>
                {setting.type === 'textarea' ? (
                  <textarea
                    value={settings[setting.key] || ''}
                    onChange={(e) => updateSetting(setting.key, e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm resize-none focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                ) : (
                  <input
                    type={setting.type}
                    value={settings[setting.key] || ''}
                    onChange={(e) => updateSetting(setting.key, e.target.value)}
                    className="mt-1 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                )}
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{setting.key}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
