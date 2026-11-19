import React from 'react';

export type BadgeVariant = 'verified' | 'pending' | 'rejected' | 'role' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  role: 'bg-primary-50 text-primary-700 border-primary-100',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
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
