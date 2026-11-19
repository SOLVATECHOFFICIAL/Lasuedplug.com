import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({
  padded = true,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm ${
        padded ? 'p-5' : ''
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
