import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'interactive' | 'outline';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  hoverEffect = false,
  ...props
}) => {
  const base = 'rounded-2xl transition-all duration-200';

  const variants = {
    default: 'bg-slate-900/80 border border-slate-800 text-slate-100 backdrop-blur-sm',
    elevated: 'bg-slate-900 border border-slate-800/80 shadow-xl shadow-black/40 text-slate-100',
    glass: 'bg-slate-900/60 backdrop-blur-md border border-slate-800/60 shadow-lg text-slate-100',
    interactive: 'bg-slate-900/90 border border-slate-800 text-slate-100 hover:border-slate-700 hover:bg-slate-800/80 cursor-pointer',
    outline: 'bg-transparent border border-slate-800 text-slate-100',
  };

  const hover = hoverEffect ? 'hover:border-brand-500/50 hover:shadow-brand-500/10 hover:shadow-lg hover:-translate-y-0.5' : '';

  return (
    <div className={twMerge(clsx(base, variants[variant], hover, className))} {...props}>
      {children}
    </div>
  );
};
