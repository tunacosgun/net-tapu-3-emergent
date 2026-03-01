import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
