'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { showApiError } from '@/components/api-error-toast';
import { TableSkeleton } from '@/components/skeleton';
import { formatDate, formatPrice, timeAgo } from '@/lib/format';
import { PageHeader, Badge, Pagination } from '@/components/ui';
import type { ContactRequest, PaginatedResponse, UserActivity, ActivitySummary } from '@/types';

const typeLabels: Record<string, string> = { call_me: 'Beni Ara', parcel_inquiry: 'Arsa Sorgulama', general: 'Genel' };
const typeIcons: Record<string, string> = { call_me: '📞', parcel_inquiry: '🏠', general: '💬' };
const statusLabels: Record<string, string> = { new: 'Yeni', assigned: 'Atandı', in_progress: 'İşlemde', completed: 'Tamamlandı', cancelled: 'İptal' };
const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', assigned: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-700',
};

const activityLabels: Record<string, string> = {
  parcel_view: 'İlan görüntüledi',
  search: 'Arama yaptı',
  add_favorite: 'Favorilere ekledi',
  remove_favorite: 'Favorilerden çıkardı',
  page_view: 'Sayfa görüntüledi',
  auction_view: 'Açık artırma görüntüledi',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-1 text-[10px] text-[var(--muted-foreground)] hover:text-brand-600"
      title="Kopyala"
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

function ActivityPanel({ contactId }: { contactId: string }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);

  useEffect(() => {
    apiClient.get<{ activities: UserActivity[]; summary: ActivitySummary | null }>(`/crm/contact-requests/${contactId}/activity`)
      .then(({ data }) => {
        setActivities(data.activities || []);
        setSummary(data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) return <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]"><div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> Aktivite yükleniyor...</div>;

  if (!summary || activities.length === 0) {
    return <p className="py-3 text-xs text-[var(--muted-foreground)]">Kullanıcı aktivitesi bulunamadı (anonim ziyaretçi olabilir)</p>;
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-blue-50 p-2.5 text-center">
          <p className="text-lg font-bold text-blue-700">{summary.totalActions}</p>
          <p className="text-[10px] text-blue-600">Toplam İşlem</p>
        </div>
        <div className="rounded-lg bg-green-50 p-2.5 text-center">
          <p className="text-lg font-bold text-green-700">{summary.parcelsViewed}</p>
          <p className="text-[10px] text-green-600">İlan Görüntüleme</p>
        </div>
        <div className="rounded-lg bg-purple-50 p-2.5 text-center">
          <p className="text-lg font-bold text-purple-700">{summary.firstVisit ? timeAgo(summary.firstVisit) : '—'}</p>
          <p className="text-[10px] text-purple-600">İlk Ziyaret</p>
        </div>
        <div className="rounded-lg bg-orange-50 p-2.5 text-center">
          <p className="text-lg font-bold text-orange-700">{summary.lastVisit ? timeAgo(summary.lastVisit) : '—'}</p>
          <p className="text-[10px] text-orange-600">Son Aktivite</p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--foreground)] mb-2">Son Aktiviteler</h4>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {activities.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-[var(--border)] last:border-0">
              <span className="text-[var(--muted-foreground)] w-20 flex-shrink-0">{timeAgo(a.createdAt)}</span>
              <span className="font-medium">{activityLabels[a.action] || a.action}</span>
              {a.resourceType === 'parcel' && a.resourceId && (
                <Link href={`/admin/parcels/${a.resourceId}`} className="text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                  {(a.metadata as Record<string, string>)?.title || 'İlan'}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminContactsPage() {
  const [data, setData] = useState<PaginatedResponse<ContactRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data: res } = await apiClient.get<PaginatedResponse<ContactRequest>>('/crm/contact-requests', { params });
      setData(res);
    } catch (err) { showApiError(err); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  function handleSearch(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 300);
  }

  async function updateStatus(id: string, newStatus: string) {
    setEditing(id);
    try {
      await apiClient.patch(`/crm/contact-requests/${id}`, { status: newStatus });
      await fetchContacts();
    } catch (err) { showApiError(err); }
    finally { setEditing(null); }
  }

  const isUrgent = (c: ContactRequest) => {
    if (c.status !== 'new') return false;
    const mins = (Date.now() - new Date(c.createdAt).getTime()) / 60000;
    return mins < 30;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="İletişim Talepleri" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="İsim veya telefon ile ara..."
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm">
          <option value="">Tüm Durumlar</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {data && (
          <div className="flex items-center text-xs text-[var(--muted-foreground)]">
            {data.meta.total} kayıt
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? <TableSkeleton rows={8} cols={7} /> : data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--background)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Müşteri</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Telefon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">İlan Bilgisi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Tür</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Zaman</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Atanan</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">Sonuç bulunamadı.</td></tr>
                ) : data.data.map((c) => (
                  <>
                    {/* Main Row */}
                    <tr
                      key={c.id}
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className={`border-b border-[var(--border)] cursor-pointer transition-colors hover:bg-[var(--muted)]/20 ${
                        isUrgent(c) ? 'border-l-4 border-l-orange-500 bg-orange-50/30' : ''
                      } ${expandedId === c.id ? 'bg-brand-50/30' : ''}`}
                    >
                      {/* Müşteri */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{c.name}</p>
                          <p className="text-[11px] text-[var(--muted-foreground)]">{c.user?.email || c.email || '—'}</p>
                        </div>
                      </td>

                      {/* Telefon */}
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className="font-mono text-xs">{c.phone}</span>
                          <CopyButton text={c.phone} />
                        </div>
                      </td>

                      {/* İlan Bilgisi */}
                      <td className="px-4 py-3">
                        {c.parcel ? (
                          <div>
                            <Link
                              href={`/admin/parcels/${c.parcelId}`}
                              className="text-xs font-medium text-brand-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {c.parcel.title}
                            </Link>
                            <p className="text-[10px] text-[var(--muted-foreground)]">
                              {c.parcel.listingId} · {c.parcel.city}, {c.parcel.district}
                              {c.parcel.price && ` · ${formatPrice(c.parcel.price)}`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">Genel Talep</span>
                        )}
                      </td>

                      {/* Tür */}
                      <td className="px-4 py-3">
                        <span className="text-xs">
                          {typeIcons[c.type] || ''} {typeLabels[c.type] || c.type}
                        </span>
                      </td>

                      {/* Durum */}
                      <td className="px-4 py-3">
                        <Badge className={statusColors[c.status] || ''}>
                          {statusLabels[c.status] || c.status}
                        </Badge>
                      </td>

                      {/* Zaman */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs font-medium text-[var(--foreground)]">{timeAgo(c.createdAt)}</p>
                          <p className="text-[10px] text-[var(--muted-foreground)]">{formatDate(c.createdAt)}</p>
                        </div>
                      </td>

                      {/* Atanan */}
                      <td className="px-4 py-3">
                        {c.assignee ? (
                          <span className="text-xs">{c.assignee.firstName} {c.assignee.lastName}</span>
                        ) : (
                          <span className="text-[10px] text-[var(--muted-foreground)]">Atanmadı</span>
                        )}
                      </td>

                      {/* Status dropdown */}
                      <td className="px-4 py-3">
                        <select
                          value={c.status}
                          onChange={(e) => { e.stopPropagation(); updateStatus(c.id, e.target.value); }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={editing === c.id}
                          className="rounded border border-[var(--input)] bg-[var(--background)] px-2 py-0.5 text-xs disabled:opacity-50"
                        >
                          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                    </tr>

                    {/* Expanded Detail */}
                    {expandedId === c.id && (
                      <tr key={`${c.id}-detail`} className="bg-[var(--muted)]/10">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left: Message + Parcel */}
                            <div className="space-y-3">
                              {c.message && (
                                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                                  <h4 className="text-xs font-semibold text-[var(--muted-foreground)] mb-1">Mesaj</h4>
                                  <p className="text-sm">{c.message}</p>
                                </div>
                              )}

                              {c.parcel && (
                                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                                  <h4 className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">İlan Detayı</h4>
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                      <Link href={`/admin/parcels/${c.parcelId}`} className="text-sm font-semibold text-brand-600 hover:underline">
                                        {c.parcel.title}
                                      </Link>
                                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                                        {c.parcel.listingId} · {c.parcel.city}, {c.parcel.district}
                                      </p>
                                      {c.parcel.price && (
                                        <p className="text-sm font-bold text-green-700 mt-1">{formatPrice(c.parcel.price)}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                                <h4 className="text-xs font-semibold text-[var(--muted-foreground)] mb-1">İletişim Bilgileri</h4>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div><span className="text-[var(--muted-foreground)]">Ad:</span> {c.name}</div>
                                  <div><span className="text-[var(--muted-foreground)]">Tel:</span> <span className="font-mono">{c.phone}</span></div>
                                  {(c.user?.email || c.email) && (
                                    <div className="col-span-2"><span className="text-[var(--muted-foreground)]">E-posta:</span> {c.user?.email || c.email}</div>
                                  )}
                                  {c.ipAddress && (
                                    <div><span className="text-[var(--muted-foreground)]">IP:</span> <span className="font-mono">{c.ipAddress}</span></div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Activity */}
                            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                              <h4 className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">Kullanıcı Aktivitesi</h4>
                              {c.userId ? (
                                <ActivityPanel contactId={c.id} />
                              ) : (
                                <p className="text-xs text-[var(--muted-foreground)] py-3">Anonim ziyaretçi — kullanıcı hesabı bağlı değil</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
