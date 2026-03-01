import { type ReactNode } from 'react';

const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
} as const;

interface BadgeProps {
  variant?: keyof typeof variantClasses;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${className ?? variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
