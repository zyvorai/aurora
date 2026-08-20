'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light-theme', theme === 'light');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    const systemPrefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
    const initialTheme: Theme =
      storedTheme === 'light' || (!storedTheme && systemPrefersLight) ? 'light' : 'dark';
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Inline script string — run in <head> before paint to avoid a flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('${STORAGE_KEY}');
  var systemLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  if (t === 'light' || (!t && systemLight)) document.documentElement.classList.add('light-theme');
} catch (e) {}
`;
