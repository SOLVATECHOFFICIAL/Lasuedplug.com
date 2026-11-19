import { Loader2 } from 'lucide-react';

interface LoadingProps {
  message?: string;
  variant?: 'spinner' | 'skeleton';
  fullScreen?: boolean;
}

export function Loading({
  message = 'Loading...',
  variant = 'spinner',
  fullScreen = false,
}: LoadingProps) {
  if (variant === 'skeleton') {
    return (
      <div
        role="status"
        aria-label={message}
        className="max-w-3xl mx-auto p-6 space-y-4 animate-pulse"
      >
        <div className="h-6 bg-gray-200 rounded-lg w-1/3" />
        <div className="h-24 bg-gray-200 rounded-xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-28 bg-gray-200 rounded-xl" />
          <div className="h-28 bg-gray-200 rounded-xl" />
        </div>
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 text-gray-500 ${
        fullScreen ? 'min-h-[60vh]' : 'py-12'
      }`}
    >
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
