'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDelayedUnmount } from '@/hooks/useDelayedUnmount';
import { TONE_CLASSES } from '@/lib/tone';
import type { Tone } from '@/components/layout/PageHero';

export interface CommandPaletteItem {
  id: string;
  label: string;
  group?: string;
  keywords?: string;
  icon?: LucideIcon;
  /** Colors the item's icon tile, macOS-Spotlight-style -- omit for a neutral tile. */
  tone?: Tone;
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
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rendered = useDelayedUnmount(open, 150);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !rendered) return null;

  let flatIndex = -1;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[15vh] bg-black/60 backdrop-blur-sm',
        open ? 'animate-fade-in' : 'animate-fade-out',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={cn(
          'glass-strong w-full max-w-lg overflow-hidden rounded-[var(--radius-liquid-lg)]',
          open ? 'animate-glass-in' : 'animate-glass-out',
        )}
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
                const Icon = item.icon;
                const tone = item.tone ? TONE_CLASSES[item.tone] : null;
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
                      'w-full flex items-center gap-2.5 px-4 py-2 text-left text-body-sm',
                      isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-surface',
                    )}
                  >
                    {Icon && (
                      <span
                        className={cn(
                          'w-6 h-6 flex items-center justify-center rounded-[7px] shrink-0',
                          tone ? tone.bg : 'bg-surface',
                          tone ? tone.text : 'text-muted',
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden />
                      </span>
                    )}
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
