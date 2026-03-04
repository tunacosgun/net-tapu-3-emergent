interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className = '' }: EmptyStateProps) {
  return (
    <p className={`mt-12 text-center text-[var(--muted-foreground)] ${className}`}>
      {message}
    </p>
  );
}
