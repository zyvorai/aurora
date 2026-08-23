'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dismissToast, subscribeToasts, type ToastMessage, type ToastVariant } from '@/lib/toast';

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  error: 'border-danger/30 bg-danger/10 text-danger',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-primary/30 bg-primary/10 text-primary',
};

const EXIT_MS = 150;

function ToastItem({ toast, closing }: { toast: ToastMessage; closing: boolean }) {
  const Icon = ICONS[toast.variant];
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-[var(--radius-liquid)] border px-4 py-3 shadow-lg',
        'bg-[var(--glass-bg-elevated)] backdrop-blur-[var(--blur-liquid-sm)] text-body-sm',
        closing ? 'animate-slide-out' : 'animate-slide-in',
        VARIANT_CLASSES[toast.variant],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-foreground">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  // Kept as a superset of the lib's live toast list -- a toast that's been dismissed
  // (manually or via the lib's auto-dismiss timer) stays here, marked "closing", for
  // EXIT_MS so it can play .animate-slide-out instead of vanishing the instant the
  // lib's array (and thus the subscription callback) drops it.
  const [displayed, setDisplayed] = useState<ToastMessage[]>([]);
  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  // Mirrors closingIds for the subscription callback below, which is registered once
  // (effect deps []) and would otherwise read a stale closure of the state value.
  const closingIdsRef = useRef<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set());

  function updateClosingIds(next: Set<string>) {
    closingIdsRef.current = next;
    setClosingIds(next);
  }

  useEffect(
    () =>
      subscribeToasts((live) => {
        const liveIds = new Set(live.map((t) => t.id));
        const removed = [...prevIds.current].filter((id) => !liveIds.has(id));
        prevIds.current = liveIds;

        setDisplayed((prev) => {
          const prevById = new Map(prev.map((t) => [t.id, t]));
          const stillClosing = prev.filter(
            (t) => closingIdsRef.current.has(t.id) && !removed.includes(t.id),
          );
          return [...live.map((t) => prevById.get(t.id) ?? t), ...stillClosing];
        });

        if (removed.length > 0) {
          updateClosingIds(new Set([...closingIdsRef.current, ...removed]));
          removed.forEach((id) => {
            setTimeout(() => {
              setDisplayed((prev) => prev.filter((t) => t.id !== id));
              const next = new Set(closingIdsRef.current);
              next.delete(id);
              updateClosingIds(next);
            }, EXIT_MS);
          });
        }
      }),
    [],
  );

  if (displayed.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {displayed.map((toast) => (
        <ToastItem key={toast.id} toast={toast} closing={closingIds.has(toast.id)} />
      ))}
    </div>
  );
}
