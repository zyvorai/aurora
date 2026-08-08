'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';
/** Accent color palette, layered on top of dark mode -- ported from hyper2kvm's
 * steel/aurora variants. Dark-mode-only (see applyColorVariant below). */
export type ColorVariant = 'default' | 'steel' | 'aurora';
/** Surface design style -- 'classic' swaps the frosted-glass Tahoe surfaces for solid
 * zinc panels with no blur, ported from hyper2kvm's classic-zinc.css. */
export type DesignStyle = 'modern' | 'classic';

const STORAGE_KEY = 'theme';
const COLOR_VARIANT_KEY = 'theme_color_variant';
const DESIGN_STYLE_KEY = 'theme_design_style';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  colorVariant: ColorVariant;
  setColorVariant: (variant: ColorVariant) => void;
  designStyle: DesignStyle;
  setDesignStyle: (style: DesignStyle) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light-theme', theme === 'light');
}

function applyColorVariant(variant: ColorVariant) {
  document.documentElement.classList.toggle('steel-theme', variant === 'steel');
  document.documentElement.classList.toggle('aurora-theme', variant === 'aurora');
}

function applyDesignStyle(style: DesignStyle) {
  document.documentElement.classList.toggle('classic-theme', style === 'classic');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [colorVariant, setColorVariantState] = useState<ColorVariant>('default');
  const [designStyle, setDesignStyleState] = useState<DesignStyle>('modern');

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    const initialTheme: Theme = storedTheme === 'light' ? 'light' : 'dark';
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    const storedVariant = localStorage.getItem(COLOR_VARIANT_KEY);
    const initialVariant: ColorVariant =
      storedVariant === 'steel' || storedVariant === 'aurora' ? storedVariant : 'default';
    setColorVariantState(initialVariant);
    applyColorVariant(initialVariant);

    const storedStyle = localStorage.getItem(DESIGN_STYLE_KEY);
    const initialStyle: DesignStyle = storedStyle === 'classic' ? 'classic' : 'modern';
    setDesignStyleState(initialStyle);
    applyDesignStyle(initialStyle);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const setColorVariant = useCallback((next: ColorVariant) => {
    setColorVariantState(next);
    applyColorVariant(next);
    localStorage.setItem(COLOR_VARIANT_KEY, next);
  }, []);

  const setDesignStyle = useCallback((next: DesignStyle) => {
    setDesignStyleState(next);
    applyDesignStyle(next);
    localStorage.setItem(DESIGN_STYLE_KEY, next);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, colorVariant, setColorVariant, designStyle, setDesignStyle }}
    >
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
  if (t === 'light') document.documentElement.classList.add('light-theme');
  var v = localStorage.getItem('${COLOR_VARIANT_KEY}');
  if (v === 'steel') document.documentElement.classList.add('steel-theme');
  if (v === 'aurora') document.documentElement.classList.add('aurora-theme');
  var s = localStorage.getItem('${DESIGN_STYLE_KEY}');
  if (s === 'classic') document.documentElement.classList.add('classic-theme');
} catch (e) {}
`;
