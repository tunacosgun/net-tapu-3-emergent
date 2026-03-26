import { type ReactNode } from 'react';

const variantClasses = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  // Parcel status variants
  active: 'bg-emerald-50 text-emerald-700',
  sold: 'bg-red-50 text-red-700',
  deposit_taken: 'bg-amber-50 text-amber-700',
  draft: 'bg-slate-100 text-slate-500',
  withdrawn: 'bg-slate-100 text-slate-400',
  reserved: 'bg-purple-50 text-purple-700',
} as const;

interface BadgeProps {
  variant?: keyof typeof variantClasses;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${variantClasses[variant] ?? variantClasses.default} ${className ?? ''}`}
    >
      {children}
    </span>
  );
}

/** Maps parcel status string to badge variant + Turkish label */
export function parcelStatusConfig(status: string): { variant: keyof typeof variantClasses; label: string } {
  switch (status) {
    case 'active':
      return { variant: 'active', label: 'Satışta' };
    case 'sold':
      return { variant: 'sold', label: 'Satıldı' };
    case 'deposit_taken':
      return { variant: 'deposit_taken', label: 'Kaparo Alındı' };
    case 'draft':
      return { variant: 'draft', label: 'Taslak' };
    case 'withdrawn':
      return { variant: 'withdrawn', label: 'Geri Çekildi' };
    case 'reserved':
      return { variant: 'reserved', label: 'Ayırtıldı' };
    default:
      return { variant: 'default', label: status };
  }
}

/** Color for map pins / dots based on parcel status */
export function parcelStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return '#059669'; // emerald
    case 'sold':
      return '#ef4444'; // red
    case 'deposit_taken':
      return '#f59e0b'; // amber
    case 'reserved':
      return '#a855f7'; // purple
    case 'draft':
    case 'withdrawn':
    default:
      return '#94a3b8'; // slate
  }
}
