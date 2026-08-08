import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutOptions {
  key: string;
  handler: () => void;
  enabled?: boolean;
  ctrlOrMeta?: boolean;
  shift?: boolean;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Binds a single global keyboard shortcut. Ignored while focus is in a form field. */
export function useKeyboardShortcut({
  key,
  handler,
  enabled = true,
  ctrlOrMeta = false,
  shift = false,
}: UseKeyboardShortcutOptions) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && EDITABLE_TAGS.has(target.tagName)) return;
      if (target?.isContentEditable) return;

      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (ctrlOrMeta && !(event.ctrlKey || event.metaKey)) return;
      if (!ctrlOrMeta && (event.ctrlKey || event.metaKey)) return;
      if (shift && !event.shiftKey) return;

      event.preventDefault();
      handlerRef.current();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [key, enabled, ctrlOrMeta, shift]);
}
