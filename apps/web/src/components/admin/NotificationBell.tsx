'use client';

import { useEffect, useState, useRef } from 'react';
import apiClient from '@/lib/api-client';
import { formatDate } from '@/lib/format';

interface AdminNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  bid: '🔨',
  user_registered: '👤',
  bank_transfer: '🏦',
  auction_won: '🏆',
  deposit: '💰',
  payment: '💳',
  offer: '📋',
  contact: '📞',
  system: '⚙️',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const { data } = await apiClient.get('/notifications', {
        params: { limit: 20 },
      });
      const items = data.data || data || [];
      setNotifications(items);
      setUnreadCount(items.filter((n: AdminNotification) => !n.readAt).length);
    } catch {
      // Silently fail
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function markAsRead(id: string) {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }

  async function markAllRead() {
    try {
      await Promise.all(
        notifications.filter((n) => !n.readAt).map((n) => apiClient.patch(`/notifications/${n.id}/read`)),
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {}
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--muted)] transition-colors"
        title="Bildirimler"
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h3 className="font-semibold text-sm">Bildirimler</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand-500 hover:underline"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">
                <span className="text-2xl block mb-2">🔔</span>
                Henüz bildirim yok
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.readAt) markAsRead(n.id);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors ${
                    !n.readAt ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <span className="text-lg mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.readAt ? 'font-semibold' : 'font-medium'} text-[var(--foreground)]`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                        {formatDate(n.createdAt, 'datetime')}
                      </p>
                    </div>
                    {!n.readAt && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-[var(--border)] text-center">
              <a href="/admin/notifications" className="text-xs text-brand-500 hover:underline">
                Tüm bildirimleri gör →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
