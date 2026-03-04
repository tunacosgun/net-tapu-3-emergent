import { type ReactNode } from 'react';

const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  // Parcel status variants
  active: 'bg-green-100 text-green-700',
  sold: 'bg-red-100 text-red-700',
  deposit_taken: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-500',
  withdrawn: 'bg-gray-100 text-gray-400',
  reserved: 'bg-purple-100 text-purple-700',
} as const;

interface BadgeProps {
  variant?: keyof typeof variantClasses;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant] ?? variantClasses.default} ${className ?? ''}`}
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
      return '#22c55e'; // green
    case 'sold':
      return '#ef4444'; // red
    case 'deposit_taken':
      return '#3b82f6'; // blue
    case 'reserved':
      return '#a855f7'; // purple
    case 'draft':
    case 'withdrawn':
    default:
      return '#9ca3af'; // gray
  }
}
