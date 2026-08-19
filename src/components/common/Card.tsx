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
    default: 'bg-white dark:bg-[#151928] border border-[#eaecf0] dark:border-[#22283a] text-[#101828] dark:text-[#f8f9fc] shadow-xs',
    elevated: 'bg-white dark:bg-[#181d2f] border border-[#eaecf0] dark:border-[#22283a] shadow-md text-[#101828] dark:text-[#f8f9fc]',
    glass: 'bg-white/90 dark:bg-[#151928]/80 backdrop-blur-md border border-[#eaecf0] dark:border-[#22283a] shadow-xs text-[#101828] dark:text-[#f8f9fc]',
    interactive: 'bg-white dark:bg-[#151928] border border-[#eaecf0] dark:border-[#22283a] text-[#101828] dark:text-[#f8f9fc] hover:border-[#6941c6]/40 hover:shadow-md cursor-pointer',
    outline: 'bg-transparent border border-[#eaecf0] dark:border-[#22283a] text-[#101828] dark:text-[#f8f9fc]',
  };

  const hover = hoverEffect ? 'hover:border-[#6941c6] hover:shadow-md hover:-translate-y-0.5' : '';

  return (
    <div className={twMerge(clsx(base, variants[variant], hover, className))} {...props}>
      {children}
    </div>
  );
};
