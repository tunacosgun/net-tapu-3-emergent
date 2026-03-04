'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Card, Button, Alert, LoadingState } from '@/components/ui';
import { showApiError } from '@/components/api-error-toast';

interface NotificationCategory {
  key: string;
  label: string;
  description: string;
}

interface NotificationPreferences {
  [category: string]: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: 'price_drop',
    label: 'Fiyat Düşüşü',
    description: 'Takip ettiğiniz arsaların fiyatı düştüğünde bildirim alın',
  },
  {
    key: 'auction_alert',
    label: 'İhale Bildirimleri',
    description: 'İhale başlangıcı, bitiş hatırlatması ve sonuç bildirimleri',
  },
  {
    key: 'offer_update',
    label: 'Teklif Güncellemeleri',
    description: 'Tekliflerinize gelen yanıtlar ve durum değişiklikleri',
  },
  {
    key: 'new_listing',
    label: 'Yeni İlanlar',
    description: 'Arama kriterlerinize uyan yeni arsalar eklendiğinde',
  },
  {
    key: 'payment_update',
    label: 'Ödeme Bildirimleri',
    description: 'Ödeme onayları, iade bildirimleri ve fatura hatırlatmaları',
  },
  {
    key: 'marketing',
    label: 'Pazarlama & Kampanyalar',
    description: 'Özel kampanyalar, indirimler ve duyurular',
  },
];

const CHANNELS = [
  { key: 'email', label: 'E-posta', icon: '📧' },
  { key: 'sms', label: 'SMS', icon: '📱' },
  { key: 'push', label: 'Bildirim', icon: '🔔' },
] as const;

const defaultPreferences: NotificationPreferences = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((cat) => [
    cat.key,
    { email: true, sms: false, push: true },
  ]),
);

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<NotificationPreferences>('/auth/notification-preferences')
      .then(({ data }) => {
        if (data && typeof data === 'object') {
          // Merge received prefs with defaults to ensure all categories exist
          const merged = { ...defaultPreferences };
          for (const key of Object.keys(data)) {
            if (merged[key]) {
              merged[key] = { ...merged[key], ...data[key] };
            }
          }
          setPrefs(merged);
        }
      })
      .catch(() => {
        // API may not exist yet — use defaults
        setError(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function togglePref(category: string, channel: 'email' | 'sms' | 'push') {
    setPrefs((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: !prev[category][channel],
      },
    }));
    setSuccess(false);
  }

  function toggleAllForChannel(channel: 'email' | 'sms' | 'push') {
    setPrefs((prev) => {
      const allEnabled = NOTIFICATION_CATEGORIES.every((cat) => prev[cat.key]?.[channel]);
      const updated = { ...prev };
      for (const cat of NOTIFICATION_CATEGORIES) {
        updated[cat.key] = {
          ...updated[cat.key],
          [channel]: !allEnabled,
        };
      }
      return updated;
    });
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setSuccess(false);
    try {
      await apiClient.patch('/auth/notification-preferences', prefs);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <h2 className="text-lg font-semibold">Bildirim Ayarları</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Hangi bildirimleri hangi kanaldan almak istediğinizi seçin
      </p>

      {error && <Alert className="mt-4">{error}</Alert>}
      {success && (
        <Alert variant="success" className="mt-4">
          Bildirim tercihleriniz kaydedildi.
        </Alert>
      )}

      <Card className="mt-6 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_repeat(3,80px)] items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-3">
          <span className="text-sm font-medium">Bildirim Türü</span>
          {CHANNELS.map((ch) => (
            <button
              key={ch.key}
              onClick={() => toggleAllForChannel(ch.key)}
              className="flex flex-col items-center gap-0.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              title={`Tümünü ${ch.label} için aç/kapat`}
            >
              <span>{ch.icon}</span>
              <span>{ch.label}</span>
            </button>
          ))}
        </div>

        {/* Category rows */}
        {NOTIFICATION_CATEGORIES.map((cat, idx) => (
          <div
            key={cat.key}
            className={`grid grid-cols-[1fr_repeat(3,80px)] items-center gap-2 px-4 py-3 ${
              idx < NOTIFICATION_CATEGORIES.length - 1 ? 'border-b border-[var(--border)]' : ''
            }`}
          >
            <div>
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{cat.description}</p>
            </div>
            {CHANNELS.map((ch) => (
              <div key={ch.key} className="flex justify-center">
                <ToggleSwitch
                  checked={prefs[cat.key]?.[ch.key] ?? false}
                  onChange={() => togglePref(cat.key, ch.key)}
                />
              </div>
            ))}
          </div>
        ))}
      </Card>

      <div className="mt-6 flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setPrefs(defaultPreferences);
            setSuccess(false);
          }}
        >
          Varsayılana Dön
        </Button>
      </div>

      {/* Info note */}
      <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
        <p className="font-medium">Bilgi</p>
        <p className="mt-1">
          Ödeme onayları ve güvenlik bildirimleri gibi kritik bildirimler her zaman e-posta ile
          gönderilir ve kapatılamaz. SMS bildirimleri için telefon numaranızın doğrulanmış olması
          gerekir.
        </p>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
        checked ? 'bg-brand-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
