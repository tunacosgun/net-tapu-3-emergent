'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { PageHeader, DataTable, Badge, Button, type Column } from '@/components/ui';
import { TableSkeleton } from '@/components/skeleton';
import { formatDate } from '@/lib/format';

interface IpBan {
  id: string;
  ipAddress: string;
  userId: string | null;
  reason: string | null;
  restrictedFeatures: string[];
  bannedAt: string;
  createdAt: string;
  expiresAt: string | null;
  createdBy: string | null;
}

const FEATURE_OPTIONS = [
  { value: 'full', label: 'Tüm Site' },
  { value: 'auctions', label: 'Açık Artırmalar' },
  { value: 'parcels', label: 'Arsalar' },
  { value: 'bidding', label: 'Teklif Verme' },
  { value: 'messaging', label: 'İletişim' },
];

const FEATURE_LABELS: Record<string, string> = Object.fromEntries(FEATURE_OPTIONS.map(f => [f.value, f.label]));

interface LoginAttempt {
  id: string;
  ipAddress: string;
  email: string;
  success: boolean;
  userAgent: string | null;
  createdAt: string;
}

const BAN_REASONS = [
  { value: 'spam', label: 'Spam / İstenmeyen İçerik' },
  { value: 'brute-force', label: 'Kaba Kuvvet Saldırısı' },
  { value: 'abuse', label: 'Kötüye Kullanım' },
  { value: 'fraud', label: 'Dolandırıcılık Girişimi' },
  { value: 'suspicious', label: 'Şüpheli Aktivite' },
  { value: 'other', label: 'Diğer (Özel Sebep)' },
];

const BAN_DURATIONS = [
  { value: '1', label: '1 Saat' },
  { value: '6', label: '6 Saat' },
  { value: '24', label: '24 Saat' },
  { value: '168', label: '1 Hafta' },
  { value: '720', label: '30 Gün' },
  { value: 'permanent', label: 'Süresiz' },
];

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Bilinmeyen';
  let device = 'Bilinmeyen';
  if (/iPhone|iPad/i.test(ua)) device = '📱 iOS';
  else if (/Android/i.test(ua)) device = '📱 Android';
  else if (/Mac/i.test(ua)) device = '💻 Mac';
  else if (/Windows/i.test(ua)) device = '💻 Windows';
  else if (/Linux/i.test(ua)) device = '💻 Linux';

  let browser = '';
  if (/Chrome\/\d/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\/\d/i.test(ua)) browser = 'Firefox';
  else if (/Safari\/\d/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  return browser ? `${device} / ${browser}` : device;
}

function formatIp(ip: string | null): string {
  if (!ip) return '—';
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1 (yerel)';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

export default function AdminBansPage() {
  const [bans, setBans] = useState<IpBan[]>([]);
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [attemptsTotal, setAttemptsTotal] = useState(0);
  const [attemptsPage, setAttemptsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAddBan, setShowAddBan] = useState(false);
  const [quickBanTarget, setQuickBanTarget] = useState<{ ip: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'bans' | 'attempts'>('bans');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [bansRes, attemptsRes] = await Promise.allSettled([
        apiClient.get('/admin/bans'),
        apiClient.get('/admin/bans/login-attempts', { params: { limit: 50, page } }),
      ]);
      if (bansRes.status === 'fulfilled') {
        const d = bansRes.value.data;
        setBans(Array.isArray(d) ? d : d?.data && Array.isArray(d.data) ? d.data : []);
      }
      if (attemptsRes.status === 'fulfilled') {
        const d = attemptsRes.value.data;
        if (d?.data && Array.isArray(d.data)) {
          setAttempts(d.data);
          setAttemptsTotal(d.total || 0);
        } else if (Array.isArray(d)) {
          setAttempts(d);
          setAttemptsTotal(d.length);
        } else {
          setAttempts([]);
          setAttemptsTotal(0);
        }
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(attemptsPage);
  }, [fetchData, attemptsPage]);

  async function handleRemoveBan(banId: string) {
    try {
      await apiClient.patch(`/admin/bans/${banId}/lift`);
      setBans((prev) => prev.filter((b) => b.id !== banId));
    } catch (err) {
      showApiError(err);
    }
  }

  const banColumns: Column<IpBan>[] = [
    { header: 'IP Adresi', accessor: (b) => <span className="font-mono text-sm">{formatIp(b.ipAddress)}</span> },
    { header: 'Sebep', accessor: (b) => <span className="text-sm">{b.reason || '—'}</span> },
    {
      header: 'Kısıtlamalar',
      accessor: (b) => (
        <div className="flex flex-wrap gap-1">
          {(b.restrictedFeatures || ['full']).map((f) => (
            <span key={f} className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
              {FEATURE_LABELS[f] || f}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Tarih',
      accessor: (b) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDate(b.createdAt || b.bannedAt, 'datetime')}
        </span>
      ),
    },
    {
      header: 'Bitiş',
      accessor: (b) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {b.expiresAt ? formatDate(b.expiresAt, 'datetime') : 'Süresiz'}
        </span>
      ),
    },
    {
      header: '',
      accessor: (b) => (
        <Button variant="danger" size="sm" onClick={() => handleRemoveBan(b.id)}>
          Kaldır
        </Button>
      ),
    },
  ];

  const attemptColumns: Column<LoginAttempt>[] = [
    {
      header: 'IP Adresi',
      accessor: (a) => <span className="font-mono text-sm">{formatIp(a.ipAddress)}</span>,
    },
    { header: 'E-posta', accessor: (a) => <span className="text-sm">{a.email}</span> },
    {
      header: 'Cihaz',
      accessor: (a) => <span className="text-xs">{parseUserAgent(a.userAgent)}</span>,
    },
    {
      header: 'Sonuç',
      accessor: (a) => (
        <Badge variant={a.success ? 'success' : 'danger'}>
          {a.success ? 'Başarılı' : 'Başarısız'}
        </Badge>
      ),
    },
    {
      header: 'Tarih / Saat',
      accessor: (a) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDate(a.createdAt, 'datetime')}
        </span>
      ),
    },
    {
      header: '',
      accessor: (a) => (
        <button
          onClick={() => setQuickBanTarget({ ip: a.ipAddress, email: a.email })}
          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 hover:border-red-300"
          title="Bu IP adresini engelle"
        >
          Engelle
        </button>
      ),
    },
  ];

  const totalPages = Math.ceil(attemptsTotal / 50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yasaklamalar"
        subtitle="IP yasağı yönetimi ve giriş denemeleri"
        action={
          <Button onClick={() => setShowAddBan(true)}>Yeni Yasak Ekle</Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
        <button
          onClick={() => setActiveTab('bans')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'bans'
              ? 'bg-brand-500 text-white'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
          }`}
        >
          Aktif Yasaklar ({bans.length})
        </button>
        <button
          onClick={() => setActiveTab('attempts')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'attempts'
              ? 'bg-brand-500 text-white'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
          }`}
        >
          Kayıtlar ({attemptsTotal})
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : activeTab === 'bans' ? (
        <DataTable
          columns={banColumns}
          data={bans}
          keyExtractor={(b) => b.id}
          emptyMessage="Aktif yasak bulunmuyor."
        />
      ) : (
        <>
          <DataTable
            columns={attemptColumns}
            data={attempts}
            keyExtractor={(a) => a.id}
            emptyMessage="Giriş kaydı bulunamadı."
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                size="sm"
                variant="secondary"
                disabled={attemptsPage <= 1}
                onClick={() => setAttemptsPage((p) => p - 1)}
              >
                Önceki
              </Button>
              <span className="text-sm text-[var(--muted-foreground)]">
                Sayfa {attemptsPage} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={attemptsPage >= totalPages}
                onClick={() => setAttemptsPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          )}
        </>
      )}

      {showAddBan && (
        <BanModal
          onClose={() => setShowAddBan(false)}
          onSuccess={() => {
            setShowAddBan(false);
            fetchData(attemptsPage);
          }}
        />
      )}

      {quickBanTarget && (
        <BanModal
          prefillIp={quickBanTarget.ip}
          prefillEmail={quickBanTarget.email}
          onClose={() => setQuickBanTarget(null)}
          onSuccess={() => {
            setQuickBanTarget(null);
            fetchData(attemptsPage);
          }}
        />
      )}
    </div>
  );
}

function BanModal({
  onClose,
  onSuccess,
  prefillIp,
  prefillEmail,
}: {
  onClose: () => void;
  onSuccess: () => void;
  prefillIp?: string;
  prefillEmail?: string;
}) {
  const [ip, setIp] = useState(prefillIp || '');
  const [reasonKey, setReasonKey] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [duration, setDuration] = useState('24');
  const [features, setFeatures] = useState<string[]>(['full']);
  const [saving, setSaving] = useState(false);

  function toggleFeature(val: string) {
    if (val === 'full') {
      setFeatures(['full']);
    } else {
      setFeatures((prev) => {
        const without = prev.filter((f) => f !== 'full');
        if (without.includes(val)) {
          const result = without.filter((f) => f !== val);
          return result.length === 0 ? ['full'] : result;
        }
        return [...without, val];
      });
    }
  }

  const displayIp = formatIp(ip);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const reason = reasonKey === 'other' ? customReason : BAN_REASONS.find((r) => r.value === reasonKey)?.label;
    if (!ip || !reason) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ipAddress: ip,
        reason,
        restrictedFeatures: features,
      };
      if (duration !== 'permanent') {
        const hours = parseInt(duration, 10);
        payload.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      }
      await apiClient.post('/admin/bans', payload);
      onSuccess();
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl bg-[var(--background)] p-6 shadow-2xl border border-[var(--border)]">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold">IP Engelle</h3>
            {prefillEmail && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {prefillEmail} kullanıcısının IP adresi
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* IP */}
          <div>
            <label className="block text-sm font-medium mb-1">IP Adresi</label>
            <input
              type="text"
              value={prefillIp ? displayIp : ip}
              onChange={(e) => !prefillIp && setIp(e.target.value)}
              placeholder="Örn: 192.168.1.1"
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm font-mono disabled:opacity-60"
              required
              disabled={!!prefillIp}
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-1">Engel Süresi</label>
            <div className="grid grid-cols-3 gap-2">
              {BAN_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    duration === d.value
                      ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500'
                      : 'border-[var(--border)] hover:border-red-200 hover:bg-red-50/50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feature restrictions */}
          <div>
            <label className="block text-sm font-medium mb-1">Kısıtlanan Özellikler</label>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => toggleFeature(f.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all text-left ${
                    features.includes(f.value)
                      ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500'
                      : 'border-[var(--border)] hover:border-red-200 hover:bg-red-50/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              {features.includes('full') ? 'Tüm site erişimi engellenecek.' : `${features.length} özellik kısıtlanacak.`}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium mb-1">Engel Sebebi</label>
            <div className="space-y-2">
              {BAN_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all ${
                    reasonKey === r.value
                      ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                      : 'border-[var(--border)] hover:border-red-200 hover:bg-red-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reasonKey === r.value}
                    onChange={() => setReasonKey(r.value)}
                    className="accent-red-600"
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom reason */}
          {reasonKey === 'other' && (
            <div>
              <label className="block text-sm font-medium mb-1">Özel Sebep</label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Engelleme sebebini yazın..."
                rows={2}
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2.5 text-sm resize-none"
                required
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              variant="danger"
              disabled={saving || !reasonKey || (reasonKey === 'other' && !customReason)}
              className="flex-1"
            >
              {saving ? 'Engelleniyor...' : 'Engelle'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              İptal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
