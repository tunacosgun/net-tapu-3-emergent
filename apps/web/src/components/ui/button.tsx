import { type ButtonHTMLAttributes } from 'react';

const variantClasses = {
  primary:
    'bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-sm',
  secondary:
    'border border-[var(--border)] hover:bg-[var(--muted)]',
  danger:
    'bg-red-500 hover:bg-red-600 text-white font-semibold',
  ghost:
    'text-brand-500 hover:underline',
} as const;

const sizeClasses = {
  sm: 'px-3 py-1 text-xs rounded',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-6 py-3 text-base rounded-md',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${variantClasses[variant]} ${sizeClasses[size]} transition-colors disabled:opacity-50 ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}
