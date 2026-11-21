import { BadgeCheck } from 'lucide-react';
import { AccountType } from '../../types';

interface VerifiedBadgeProps {
  showLabel?: boolean;
  label?: string;
  accountType?: AccountType | string | null;
  size?: 'xs' | 'sm';
  className?: string;
}

export function VerifiedBadge({
  showLabel = false,
  label,
  accountType,
  size = 'sm',
  className = '',
}: VerifiedBadgeProps) {
  const iconSize = size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const normalizedType =
    typeof accountType === 'string' ? accountType.trim().toLowerCase() : '';
  const resolvedLabel =
    label ||
    (normalizedType === 'business' || normalizedType === 'marketer'
      ? 'Verified Marketer'
      : normalizedType === 'student'
        ? 'Verified Student'
        : 'Verified Member');

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shrink-0 ${className}`.trim()}
        title={resolvedLabel}
      >
        <BadgeCheck className={`${iconSize} text-emerald-600 dark:text-emerald-400 shrink-0`} aria-hidden="true" />
        <span>{resolvedLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center shrink-0 text-emerald-600 dark:text-emerald-400 ${className}`.trim()}
      title={resolvedLabel}
      aria-label={resolvedLabel}
    >
      <BadgeCheck className={iconSize} aria-hidden="true" />
    </span>
  );
}
