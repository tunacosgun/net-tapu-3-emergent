import { type ReactNode } from 'react';

interface CardProps {
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ interactive, className = '', children }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-[var(--border)] p-4 ${interactive ? 'hover:border-brand-500 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
