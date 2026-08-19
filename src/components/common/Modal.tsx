import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
    full: 'max-w-7xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-white dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] animate-slide-up text-[#101828] dark:text-[#f8f9fc] transition-colors`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0] dark:border-[#23293d] bg-white/95 dark:bg-[#141824]/95 flex-shrink-0">
            <div>
              {typeof title === 'string' ? (
                <h3 className="text-base sm:text-lg font-bold text-[#101828] dark:text-[#f8f9fc] tracking-tight">{title}</h3>
              ) : (
                title
              )}
              {description && (
                <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 text-[#64748b] hover:text-[#101828] dark:text-[#9496a8] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1f2538] rounded-xl transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 text-[#334155] dark:text-[#cbd5e1]">{children}</div>
      </div>
    </div>
  );
};
