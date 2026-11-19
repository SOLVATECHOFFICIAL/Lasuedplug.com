import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  hoverable?: boolean;
}

export function Card({
  padded = true,
  hoverable = true,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${
        hoverable ? 'hover:shadow-md transition-shadow duration-200' : ''
      } ${padded ? 'p-5 sm:p-6' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
