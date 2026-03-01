import { type ReactNode } from 'react';

const variantClasses = {
  error: 'bg-red-50 text-red-700',
  warning: 'bg-yellow-50 text-yellow-800',
  info: 'bg-blue-50 text-blue-700',
  success: 'bg-green-50 text-green-700',
} as const;

interface AlertProps {
  variant?: keyof typeof variantClasses;
  className?: string;
  children: ReactNode;
}

export function Alert({ variant = 'error', className = '', children }: AlertProps) {
  return (
    <div className={`rounded-md p-3 text-sm ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
