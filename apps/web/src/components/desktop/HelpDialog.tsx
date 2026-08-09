'use client';

import { X } from 'lucide-react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ['⌘', 'K'], description: 'Open command palette (jump to any workspace)' },
  { keys: ['F3'], description: 'Open Mission Control' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close dialogs and overlays' },
];

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  useKeyboardShortcut({ key: 'Escape', handler: onClose, enabled: open });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div className="relative glass-strong rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-[var(--glass-bg)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="space-y-3">
          {SHORTCUTS.map((s) => (
            <li key={s.description} className="flex items-center justify-between gap-4">
              <span className="text-body-sm text-muted">{s.description}</span>
              <span className="flex gap-1 shrink-0">
                {s.keys.map((k) => (
                  <kbd key={k} className="px-1.5 py-0.5 rounded bg-[var(--glass-bg-elevated)] border border-[var(--glass-border)] text-xs font-mono">
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
