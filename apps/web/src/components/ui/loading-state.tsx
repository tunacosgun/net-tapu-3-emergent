interface LoadingStateProps {
  message?: string;
  centered?: boolean;
}

export function LoadingState({
  message = 'Yükleniyor...',
  centered = true,
}: LoadingStateProps) {
  return (
    <div className={centered ? 'mt-12 flex flex-col items-center justify-center' : 'flex flex-col items-center'}>
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-brand-500 mb-3" />
      <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}

/** Skeleton placeholder for auction/parcel detail pages */
export function DetailPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="flex gap-2 mb-6">
        <div className="h-3 w-16 bg-gray-200 rounded" />
        <div className="h-3 w-4 bg-gray-200 rounded" />
        <div className="h-3 w-20 bg-gray-200 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Image skeleton */}
        <div className="lg:col-span-2">
          <div className="h-[300px] lg:h-[400px] bg-gray-200 rounded-2xl" />
          <div className="flex gap-2 mt-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 w-16 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
        {/* Info skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-3/4 bg-gray-200 rounded" />
          <div className="h-4 w-1/2 bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-200 rounded-xl mt-6" />
          <div className="space-y-3 mt-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
