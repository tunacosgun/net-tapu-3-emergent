import { Card } from './card';

const variantColors = {
  default: 'text-[var(--foreground)]',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
} as const;

interface StatCardProps {
  label: string;
  value: string;
  variant?: keyof typeof variantColors;
  size?: 'sm' | 'lg';
}

export function StatCard({
  label,
  value,
  variant = 'default',
  size = 'lg',
}: StatCardProps) {
  return (
    <Card className={size === 'sm' ? 'p-3' : 'p-4'}>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p
        className={`mt-1 font-bold ${variantColors[variant]} ${size === 'sm' ? 'text-lg' : 'text-2xl'}`}
      >
        {value}
      </p>
    </Card>
  );
}
