import { Loader2 } from 'lucide-react';

interface LoadingProps {
  message?: string;
  variant?: 'spinner' | 'skeleton';
  fullScreen?: boolean;
  skeletonCount?: number;
  skeletonColumns?: 3 | 4;
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-pulse flex flex-col ${className}`.trim()}
    >
      <div className="aspect-[4/3] w-full bg-slate-200" />
      <div className="p-3.5 sm:p-4 space-y-2.5 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-3 w-1/3 bg-slate-200 rounded" />
          <div className="h-4 w-5/6 bg-slate-200 rounded" />
          <div className="h-3.5 w-2/3 bg-slate-200 rounded" />
        </div>
        <div className="pt-1 flex items-center justify-between gap-2">
          <div className="h-5 w-1/2 bg-slate-200 rounded" />
          <div className="h-3.5 w-1/4 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeletonGrid({
  count = 8,
  columns = 4,
  label = 'Loading listings...',
}: {
  count?: number;
  columns?: 3 | 4;
  label?: string;
}) {
  const gridCols =
    columns === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'
      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5';

  return (
    <div role="status" aria-label={label} className="w-full">
      <div className={`grid ${gridCols}`}>
        {Array.from({ length: count }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Loading({
  message = 'Loading...',
  variant = 'spinner',
  fullScreen = false,
  skeletonCount = 8,
  skeletonColumns = 4,
}: LoadingProps) {
  if (variant === 'skeleton') {
    return (
      <CardSkeletonGrid
        count={skeletonCount}
        columns={skeletonColumns}
        label={message}
      />
    );
  }

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${
        fullScreen ? 'min-h-[60vh]' : 'py-12'
      }`}
    >
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
