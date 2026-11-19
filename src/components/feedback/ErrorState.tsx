import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-red-200 text-center space-y-4 shadow-sm"
    >
      <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
      {onRetry && (
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-4 h-4" />
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
