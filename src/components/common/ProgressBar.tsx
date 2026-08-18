import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ProgressBarProps {
  value?: number;
  progress?: number;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  progress,
  max = 100,
  size = 'md',
  color,
  className,
  barClassName,
  showLabel = false,
}) => {
  const currentVal = value !== undefined ? value : progress !== undefined ? progress : 0;
  const percentage = Math.min(100, Math.max(0, Math.round((currentVal / max) * 100)));

  const sizeStyles = {
    xs: 'h-1.5',
    sm: 'h-2',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  return (
    <div className={twMerge('w-full flex items-center gap-3', className)}>
      <div className={twMerge('w-full bg-slate-800 rounded-full overflow-hidden', sizeStyles[size])}>
        <div
          className={twMerge('h-full bg-brand-500 rounded-full transition-all duration-300', color, barClassName)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-slate-400 min-w-[32px] text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
};
