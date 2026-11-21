import React from 'react';

export type BadgeVariant = 'verified' | 'pending' | 'rejected' | 'role' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  verified:
    'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  pending:
    'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  rejected:
    'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  role:
    'bg-primary-50 dark:bg-blue-950/60 text-primary-700 dark:text-blue-300 border-primary-100 dark:border-blue-800',
  neutral:
    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700',
};

export function Badge({
  variant = 'neutral',
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        BADGE_CLASSES[variant]
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}
