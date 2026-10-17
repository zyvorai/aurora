'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 'bottom' is a phone-friendly sheet; 'right' is a side panel. */
  side?: 'bottom' | 'right';
}

export function Drawer({ open, onClose, title, children, side = 'bottom' }: DrawerProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-[var(--scrim)]" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute flex flex-col border border-border bg-surface-elevated shadow-[var(--shadow-popover)] outline-none',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-[var(--radius-lg)]'
            : 'inset-y-0 right-0 w-full max-w-md',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-2">
          <h2 id={titleId} className="text-[length:var(--fs-h3)] font-semibold text-foreground">
            {title}
          </h2>
          <IconButton aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="overflow-y-auto overscroll-contain p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
