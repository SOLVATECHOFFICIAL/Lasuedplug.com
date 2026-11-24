import React, { memo } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  hoverable?: boolean;
}

export const Card = memo(function Card({
  padded = true,
  hoverable = true,
  className = '',
  children,
  ...rest
}: CardProps) {
  const hasCustomBg = /(?:^|\s)bg-/.test(className);
  const hasCustomBorder = /(?:^|\s)border-(?!collapse|separate|spacing)/.test(
    className
  );
  const hasCustomRounded = /(?:^|\s)rounded-/.test(className);

  return (
    <div
      className={`${hasCustomBg ? '' : 'bg-white dark:bg-slate-900'} ${
        hasCustomRounded ? '' : 'rounded-2xl'
      } border ${
        hasCustomBorder ? '' : 'border-slate-200/90 dark:border-slate-700'
      } shadow-sm transition-all duration-200 ${
        hoverable ? 'hover:shadow-md md:hover:-translate-y-0.5 active:scale-[0.99]' : ''
      } ${padded ? 'p-5 sm:p-6' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
});

