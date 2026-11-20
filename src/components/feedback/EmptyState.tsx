import { Link } from 'react-router-dom';
import { LucideIcon, PackageOpen } from 'lucide-react';
import { Button } from '../ui/Button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'Be the first to post in this category.',
  icon: Icon = PackageOpen,
  actionLabel = 'Post a Listing',
  actionTo,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}: EmptyStateProps) {
  const showPrimaryAction = Boolean(actionLabel && (actionTo || onAction));

  return (
    <div
      className={`w-full max-w-md mx-auto my-8 sm:my-12 p-6 sm:p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-4 shadow-sm transition-all duration-200 ${className}`.trim()}
    >
      <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
        <Icon className="w-7 h-7" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
      {(showPrimaryAction || (secondaryActionLabel && onSecondaryAction)) && (
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          {showPrimaryAction &&
            (onAction ? (
              <Button variant="primary" size="md" onClick={onAction}>
                {actionLabel}
              </Button>
            ) : actionTo ? (
              <Link
                to={actionTo}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[48px] md:min-h-[42px] rounded-xl bg-primary-500 text-white font-semibold text-sm hover:bg-primary-600 transition-all duration-200 active:scale-95 shadow-sm"
              >
                {actionLabel}
              </Link>
            ) : null)}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" size="md" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
