'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { SubsectionTitle } from './Typography';
import { useDelayedUnmount } from '@/hooks/useDelayedUnmount';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const rendered = useDelayedUnmount(open, 150);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !rendered) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6',
        open ? 'animate-fade-in bg-black/45' : 'animate-fade-out bg-black/45',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-surface-elevated rounded-[var(--radius-lg)] w-full max-w-md max-h-[min(90vh,720px)] flex flex-col border border-border shadow-[var(--shadow-elevated)] overflow-hidden',
          open ? 'animate-glass-in' : 'animate-glass-out',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <SubsectionTitle as="h2" id="modal-title">{title}</SubsectionTitle>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
