'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { PageHeader, DataTable, Badge, Button, type Column } from '@/components/ui';
import { TableSkeleton } from '@/components/skeleton';
import { formatDate } from '@/lib/format';

interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
}

interface Session {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  isActive: boolean;
}

interface LoginLog {
  id: string;
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  createdAt: string;
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return '—';
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

const roleLabels: Record<string, string> = {
  superadmin: 'Süper Admin',
  admin: 'Admin',
  user: 'Kullanıcı',
  consultant: 'Danışman',
  dealer: 'Bayi',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/admin/users', {
        params: { page, limit: 20, search: search || undefined },
      });
      setUsers(Array.isArray(data?.data) ? data.data : []);
      setTotal(data?.total || 0);
    } catch (err) {
      showApiError(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const columns: Column<UserRow>[] = [
    {
      header: 'Kullanıcı',
      accessor: (u) => (
        <div>
          <p className="font-medium">{u.firstName} {u.lastName}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{u.email}</p>
        </div>
      ),
    },
    {
      header: 'Telefon',
      accessor: (u) => <span className="text-sm">{u.phone || '—'}</span>,
    },
    {
      header: 'Roller',
      accessor: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r} variant={r === 'admin' || r === 'superadmin' ? 'warning' : 'default'}>
              {roleLabels[r] || r}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      header: 'Durum',
      accessor: (u) => (
        <div className="flex flex-col gap-0.5">
          <Badge variant={u.isActive ? 'success' : 'danger'}>
            {u.isActive ? 'Aktif' : 'Pasif'}
          </Badge>
          {u.isVerified && (
            <span className="text-xs text-brand-500">✓ Doğrulanmış</span>
          )}
        </div>
      ),
    },
    {
      header: 'Son Giriş',
      accessor: (u) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {u.lastLoginAt ? formatDate(u.lastLoginAt, 'datetime') : 'Hiç giriş yapmadı'}
        </span>
      ),
    },
    {
      header: 'Kayıt',
      accessor: (u) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDate(u.createdAt, 'date')}
        </span>
      ),
    },
    {
      header: '',
      accessor: (u) => (
        <Button size="sm" variant="secondary" onClick={() => setSelectedUser(u)}>
          Detay
        </Button>
      ),
    },
  ];

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <PageHeader title="Kullanıcılar" subtitle={`Toplam ${total} kullanıcı`} />

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="İsim veya e-posta ara..."
          className="w-full max-w-sm rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <Button type="submit">Ara</Button>
        {search && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              setPage(1);
            }}
          >
            Temizle
          </Button>
        )}
      </form>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={users}
            keyExtractor={(u) => u.id}
            emptyMessage="Kullanıcı bulunamadı."
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Önceki
              </Button>
              <span className="text-sm text-[var(--muted-foreground)]">
                Sayfa {page} / {totalPages}
              </span>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sonraki →
              </Button>
            </div>
          )}
        </>
      )}

      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} onRefresh={fetchUsers} />
      )}
    </div>
  );
}

function UserDetailModal({ user, onClose, onRefresh }: { user: UserRow; onClose: () => void; onRefresh: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sessions' | 'history'>('sessions');
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [userActive, setUserActive] = useState(user.isActive);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sessRes, histRes] = await Promise.allSettled([
          apiClient.get(`/admin/users/${user.id}/sessions`),
          apiClient.get(`/admin/users/${user.id}/login-history`, { params: { limit: 50 } }),
        ]);
        if (sessRes.status === 'fulfilled') {
          const d = sessRes.value.data;
          setSessions(Array.isArray(d) ? d : []);
        }
        if (histRes.status === 'fulfilled') {
          const d = histRes.value.data;
          setLoginHistory(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  async function handleToggleActive() {
    setActionLoading(true);
    try {
      const { data } = await apiClient.patch(`/admin/users/${user.id}/toggle-active`);
      setUserActive(data.isActive);
      onRefresh();
    } catch (err) {
      showApiError(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 8) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/admin/users/${user.id}/reset-password`, { newPassword });
      setShowResetPw(false);
      setNewPassword('');
    } catch (err) {
      showApiError(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteUser() {
    setActionLoading(true);
    try {
      await apiClient.delete(`/admin/users/${user.id}`);
      onRefresh();
      onClose();
    } catch (err) {
      showApiError(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeSessions() {
    setActionLoading(true);
    try {
      await apiClient.post(`/admin/users/${user.id}/revoke-sessions`);
      setSessions((prev) => prev.map((s) => ({ ...s, isActive: false, revokedAt: new Date().toISOString() })));
    } catch (err) {
      showApiError(err);
    } finally {
      setActionLoading(false);
    }
  }

  const activeSessions = sessions.filter((s) => s.isActive);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl bg-[var(--background)] p-6 shadow-xl border border-[var(--border)]">
        {/* User Info */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{user.firstName} {user.lastName}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{user.email}</p>
            {user.phone && <p className="text-sm text-[var(--muted-foreground)]">{user.phone}</p>}
          </div>
          <button onClick={onClose} className="text-2xl text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            ×
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {user.roles.map((r) => (
            <Badge key={r} variant={r === 'admin' || r === 'superadmin' ? 'warning' : 'default'}>
              {roleLabels[r] || r}
            </Badge>
          ))}
          <Badge variant={userActive ? 'success' : 'danger'}>
            {userActive ? 'Aktif' : 'Dondurulmuş'}
          </Badge>
          {user.isVerified && <Badge variant="success">Doğrulanmış</Badge>}
        </div>

        <div className="mt-2 text-xs text-[var(--muted-foreground)]">
          Kayıt: {formatDate(user.createdAt, 'datetime')} • Son giriş:{' '}
          {user.lastLoginAt ? formatDate(user.lastLoginAt, 'datetime') : 'Yok'}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
          <button
            onClick={handleToggleActive}
            disabled={actionLoading}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              userActive
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200'
                : 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
            }`}
          >
            {userActive ? 'Hesabı Dondur' : 'Hesabı Aktifleştir'}
          </button>
          <button
            onClick={() => setShowResetPw(!showResetPw)}
            className="rounded-lg border border-blue-200 bg-blue-100 px-3 py-2 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200"
          >
            Şifre Sıfırla
          </button>
          <button
            onClick={handleRevokeSessions}
            disabled={actionLoading || activeSessions.length === 0}
            className="rounded-lg border border-purple-200 bg-purple-100 px-3 py-2 text-xs font-medium text-purple-800 transition-colors hover:bg-purple-200 disabled:opacity-50"
          >
            Tüm Oturumları Sonlandır
          </button>
          <button
            onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            className="rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-xs font-medium text-red-800 transition-colors hover:bg-red-200"
          >
            Hesabı Sil
          </button>
        </div>

        {/* Reset Password Panel */}
        {showResetPw && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Yeni Şifre Belirle</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter..."
                className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              />
              <Button
                size="sm"
                disabled={actionLoading || newPassword.length < 8}
                onClick={handleResetPassword}
              >
                {actionLoading ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setShowResetPw(false); setNewPassword(''); }}>
                İptal
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-blue-600">Şifre değiştirildiğinde tüm oturumlar sonlandırılır.</p>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800 mb-1">Hesabı Silmek İstediğinize Emin Misiniz?</p>
            <p className="text-xs text-red-600 mb-3">
              Bu işlem geri alınamaz. Kullanıcının tüm kişisel verileri anonimleştirilecek, oturumları sonlandırılacak ve hesabı devre dışı bırakılacaktır.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" disabled={actionLoading} onClick={handleDeleteUser}>
                {actionLoading ? 'Siliniyor...' : 'Evet, Hesabı Sil'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Vazgeç
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'sessions'
                ? 'bg-brand-500 text-white'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
            }`}
          >
            Oturumlar ({activeSessions.length} aktif)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-brand-500 text-white'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
            }`}
          >
            Giriş Geçmişi ({loginHistory.length})
          </button>
        </div>

        {loading ? (
          <div className="mt-4"><TableSkeleton rows={4} cols={4} /></div>
        ) : activeTab === 'sessions' ? (
          <div className="mt-4 space-y-2">
            {sessions.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Oturum kaydı yok.</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 ${s.isActive ? 'border-brand-200 bg-brand-50/50' : 'border-[var(--border)]'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm font-medium">{parseUserAgent(s.deviceInfo)}</span>
                    </div>
                    <Badge variant={s.isActive ? 'success' : 'default'}>
                      {s.isActive ? 'Aktif' : s.revokedAt ? 'İptal Edildi' : 'Süresi Doldu'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-[var(--muted-foreground)]">
                    <span>IP: <span className="font-mono">{s.ipAddress || '—'}</span></span>
                    <span>Oluşturulma: {formatDate(s.createdAt, 'datetime')}</span>
                    <span>Bitiş: {formatDate(s.expiresAt, 'datetime')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                  <th className="pb-2">IP</th>
                  <th className="pb-2">Cihaz</th>
                  <th className="pb-2">Sonuç</th>
                  <th className="pb-2">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--muted-foreground)]">
                      Giriş kaydı yok.
                    </td>
                  </tr>
                ) : (
                  loginHistory.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--border)]">
                      <td className="py-2 font-mono text-xs">{l.ipAddress || '—'}</td>
                      <td className="py-2 text-xs">{parseUserAgent(l.userAgent)}</td>
                      <td className="py-2">
                        <Badge variant={l.success ? 'success' : 'danger'}>
                          {l.success ? 'Başarılı' : 'Başarısız'}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-[var(--muted-foreground)]">
                        {formatDate(l.createdAt, 'datetime')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
