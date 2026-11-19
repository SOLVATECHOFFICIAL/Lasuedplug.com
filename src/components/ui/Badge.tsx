import React from 'react';

export type BadgeVariant = 'verified' | 'pending' | 'rejected' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  verified: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
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
