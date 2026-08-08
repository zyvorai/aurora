'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CommandPaletteItem {
  id: string;
  label: string;
  group?: string;
  keywords?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  title?: string;
}

function matches(item: CommandPaletteItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.label} ${item.group ?? ''} ${item.keywords ?? ''}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default function CommandPalette({ open, onClose, items, title = 'Jump to…' }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, CommandPaletteItem[]>();
    for (const item of filtered) {
      const group = item.group ?? '';
      if (!byGroup.has(group)) {
        byGroup.set(group, []);
        order.push(group);
      }
      byGroup.get(group)!.push(item);
    }
    return order.map((group) => ({ group, items: byGroup.get(group)! }));
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          onClose();
          item.onSelect();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, activeIndex, onClose]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[15vh] bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="animate-glass-in glass-strong w-full max-w-lg overflow-hidden rounded-[var(--radius-liquid-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--glass-border)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={title}
            className="w-full bg-transparent text-body text-foreground placeholder:text-muted focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-body-sm text-muted">No matches</p>
          )}
          {groups.map(({ group, items: groupItems }) => (
            <div key={group || 'ungrouped'}>
              {group && (
                <p className="px-4 pt-2 pb-1 text-body-sm font-medium uppercase tracking-eyebrow text-muted">
                  {group}
                </p>
              )}
              {groupItems.map((item) => {
                flatIndex += 1;
                const isActive = flatIndex === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    onClick={() => {
                      onClose();
                      item.onSelect();
                    }}
                    className={cn(
                      'block w-full px-4 py-2 text-left text-body-sm',
                      isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-surface',
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
