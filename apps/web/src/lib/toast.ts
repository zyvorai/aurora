export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
}

type Listener = (toasts: ToastMessage[]) => void;

const listeners = new Set<Listener>();
let toasts: ToastMessage[] = [];
const MAX_VISIBLE = 5;
const AUTO_DISMISS_MS = 5000;

function notify() {
  for (const listener of listeners) listener(toasts);
}

/** Trigger a toast from anywhere — event handlers, hooks, promise catches. No provider/hook needed. */
export function showToast(variant: ToastVariant, message: string): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  toasts = [...toasts, { id, variant, message }].slice(-MAX_VISIBLE);
  notify();

  if (typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
  }
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}
