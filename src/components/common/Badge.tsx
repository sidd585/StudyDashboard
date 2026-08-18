import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'success' | 'danger' | 'warning' | 'neutral' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  size = 'md',
  dot = false,
  ...props
}) => {
  const base = 'inline-flex items-center font-medium rounded-full select-none';

  const variants = {
    brand: 'bg-brand-500/15 text-brand-400 border border-brand-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    neutral: 'bg-slate-800 text-slate-300 border border-slate-700',
    outline: 'bg-transparent text-slate-400 border border-slate-700',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  const dotColors = {
    brand: 'bg-brand-400',
    success: 'bg-emerald-400',
    danger: 'bg-rose-400',
    warning: 'bg-amber-400',
    neutral: 'bg-slate-400',
    outline: 'bg-slate-400',
  };

  return (
    <span className={twMerge(clsx(base, variants[variant], sizes[size], className))} {...props}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
};
