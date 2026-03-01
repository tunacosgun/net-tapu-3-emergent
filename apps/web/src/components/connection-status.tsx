'use client';

import { useConnectionStore, type ConnectionStatus } from '@/stores/connection-store';

const labels: Record<ConnectionStatus, string> = {
  connected: 'Bağlı',
  connecting: 'Bağlanıyor...',
  reconnecting: 'Yeniden bağlanıyor...',
  disconnected: 'Bağlantı kesildi',
};

const colors: Record<ConnectionStatus, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  reconnecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
};

export function ConnectionStatus() {
  const status = useConnectionStore((s) => s.status);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />
      <span className="text-[var(--muted-foreground)]">{labels[status]}</span>
    </div>
  );
}
