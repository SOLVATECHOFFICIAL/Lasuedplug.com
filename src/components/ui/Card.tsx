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

  return (
    <div
      className={`${hasCustomBg ? '' : 'bg-white'} rounded-xl border ${
        hasCustomBorder ? '' : 'border-slate-200'
      } shadow-sm transition-all duration-200 ${
        hoverable ? 'hover:shadow-lg md:hover:-translate-y-1 active:scale-95' : ''
      } ${padded ? 'p-5 sm:p-6' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
});

