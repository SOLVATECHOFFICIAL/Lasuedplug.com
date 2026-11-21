import React, { forwardRef, useId } from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  options: readonly (string | SelectOption)[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    helperText,
    placeholder = 'Select an option',
    options,
    id,
    className = '',
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`block w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed ${
          error
            ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-900/40'
            : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500'
        } ${className}`.trim()}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const item =
            typeof option === 'string'
              ? { label: option, value: option }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}
    </div>
  );
});
