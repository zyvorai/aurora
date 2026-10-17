'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

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

  // Focus management: remember the opener, move focus into the dialog, trap Tab, restore on close.
  useEffect(() => {
    if (!open || !mounted || !rendered) return;
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    (focusable()[0] ?? panel)?.focus();
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('keydown', onTab);
      returnFocusTo.current?.focus?.();
    };
  }, [open, mounted, rendered]);

  if (!mounted || !rendered) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6',
        open ? 'animate-fade-in bg-[var(--scrim)]' : 'animate-fade-out bg-[var(--scrim)]',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-surface-elevated rounded-[var(--radius-lg)] w-full max-w-md max-h-[min(90vh,720px)] flex flex-col border border-border shadow-[var(--shadow-elevated)] overflow-hidden',
          open ? 'animate-glass-in' : 'animate-glass-out',
          className,
        )}
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <SubsectionTitle as="h2" id={titleId}>{title}</SubsectionTitle>
          <Button variant="ghost" size="md" onClick={onClose} aria-label="Close" className="w-11 px-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
