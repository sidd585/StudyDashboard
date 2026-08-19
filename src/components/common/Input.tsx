import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-[#64748b] dark:text-[#9496a8] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={twMerge(
              clsx(
                'w-full bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#101828] dark:text-[#f8f9fc] placeholder-[#94a3b8] transition-colors focus:outline-none focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'hover:border-[#94a3b8] dark:hover:border-[#475569]',
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-[#64748b] dark:text-[#9496a8] pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-rose-500 mt-1 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              'w-full bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] rounded-xl p-3.5 text-xs sm:text-sm text-[#101828] dark:text-[#f8f9fc] placeholder-[#94a3b8] transition-colors focus:outline-none focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20 min-h-[90px]',
              error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'hover:border-[#94a3b8] dark:hover:border-[#475569]',
              className
            )
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-rose-500 mt-1 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, children, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1] mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              'w-full bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#101828] dark:text-[#f8f9fc] transition-colors focus:outline-none focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20 cursor-pointer',
              error ? 'border-rose-500 focus:border-rose-500' : 'hover:border-[#94a3b8] dark:hover:border-[#475569]',
              className
            )
          )}
          {...props}
        >
          {options
            ? options.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#181d2f] text-[#101828] dark:text-[#f8f9fc]">
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-xs text-rose-500 mt-1 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
