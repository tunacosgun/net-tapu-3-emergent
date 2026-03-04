interface LoadingStateProps {
  message?: string;
  centered?: boolean;
}

export function LoadingState({
  message = 'Yükleniyor...',
  centered = true,
}: LoadingStateProps) {
  return (
    <div className={centered ? 'mt-12 flex justify-center' : ''}>
      <p className="text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}
