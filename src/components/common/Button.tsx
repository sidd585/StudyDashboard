import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variantStyles = {
    primary: 'bg-brand-600 hover:bg-brand-500 text-white shadow-sm shadow-brand-500/20 focus:ring-brand-500 dark:focus:ring-offset-slate-900',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 focus:ring-slate-500 dark:focus:ring-offset-slate-900',
    outline: 'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700 focus:ring-slate-500',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 focus:ring-rose-500 dark:focus:ring-offset-slate-900',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 focus:ring-emerald-500 dark:focus:ring-offset-slate-900',
    warning: 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-500/20 focus:ring-amber-500 dark:focus:ring-offset-slate-900',
    ghost: 'bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-100 focus:ring-slate-500',
  };

  const sizeStyles = {
    xs: 'text-xs px-2.5 py-1 gap-1.5',
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variantStyles[variant], sizeStyles[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};
