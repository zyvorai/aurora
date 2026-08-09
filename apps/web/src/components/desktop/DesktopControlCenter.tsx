'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';
import { useTheme, type ColorVariant, type DesignStyle } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';

const COLOR_VARIANTS: { value: ColorVariant; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'steel', label: 'Steel' },
  { value: 'aurora', label: 'Aurora' },
];

const DESIGN_STYLES: { value: DesignStyle; label: string }[] = [
  { value: 'modern', label: 'Modern' },
  { value: 'classic', label: 'Classic' },
];

export function DesktopControlCenter() {
  const { theme, toggleTheme, colorVariant, setColorVariant, designStyle, setDesignStyle } = useTheme();
  const { signOut } = useAuth({ requireAuth: false });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  return (
    <div ref={ref} className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Control Center"
        className="flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-foreground hover:bg-[var(--glass-bg-elevated)] transition-colors focus-ring"
      >
        <SettingsIcon className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-72 glass-strong rounded-xl p-4 space-y-4 z-[500] shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-medium">Appearance</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-muted hover:text-foreground bg-[var(--glass-bg)] transition-colors focus-ring"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <div>
            <div className="text-xs text-muted mb-1.5">Accent</div>
            <div className="flex gap-1.5">
              {COLOR_VARIANTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setColorVariant(v.value)}
                  className={cn(
                    'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors focus-ring',
                    colorVariant === v.value ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground bg-[var(--glass-bg)]',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-1.5">Design</div>
            <div className="flex gap-1.5">
              {DESIGN_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setDesignStyle(s.value)}
                  className={cn(
                    'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors focus-ring',
                    designStyle === s.value ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground bg-[var(--glass-bg)]',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-xs font-medium text-muted hover:text-foreground bg-[var(--glass-bg)] transition-colors focus-ring"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
