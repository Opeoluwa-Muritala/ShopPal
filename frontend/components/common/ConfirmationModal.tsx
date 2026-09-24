'use client';

import React, { useEffect, useRef } from 'react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  isLoading = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-lg border border-slate-200 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
            <h3
              id="modal-title"
              className="text-base font-bold text-slate-900"
            >
              {title}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="text-xs text-slate-500 hover:text-slate-800 p-1 border border-slate-200 rounded"
              aria-label="Close modal"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            {description}
          </p>

          {children && <div className="mt-4">{children}</div>}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded transition disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`text-xs font-semibold text-white px-4 py-2 rounded transition disabled:opacity-50 ${
                isDanger
                  ? 'bg-red-700 hover:bg-red-800'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              <span>{isLoading ? 'Processing...' : confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
