import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel = 'Back to Home',
  actionTo = '/',
}: EmptyStateProps) {
  return (
    <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-4 shadow-sm">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
        <PackageOpen className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
        <p className="text-xs font-semibold text-blue-600 pt-1">Coming in a later prompt.</p>
      </div>
      {actionTo && (
        <div className="pt-2">
          <Link
            to={actionTo}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition shadow-sm"
          >
            {actionLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
