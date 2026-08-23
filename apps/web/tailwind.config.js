/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        foreground: 'var(--foreground)',
        muted: 'var(--muted-foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          foreground: 'var(--primary-foreground)',
        },
        border: 'var(--border)',
        ring: 'var(--ring)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        'accent-blue': 'var(--accent-blue)',
        'accent-pink': 'var(--accent-pink)',
        'accent-teal': 'var(--accent-teal)',
        'accent-purple': 'var(--accent-purple)',
        gtm: {
          bg: 'var(--background)',
          card: 'var(--surface-elevated)',
          accent: 'var(--primary)',
          border: 'var(--border)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      maxWidth: {
        content: 'var(--content-max-width)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // Trims Tailwind's default numeric scale (text-sm/lg/2xl/4xl/etc, used directly
        // all over the app -- these don't reference the --font-size-* vars above at
        // all) down to match: IBM Plex Sans has a notably large x-height and reads
        // bigger than most UI fonts at the same px size.
        xs: ['0.6875rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.2rem' }],
        base: ['0.9375rem', { lineHeight: '1.45rem' }],
        lg: ['1.0625rem', { lineHeight: '1.6rem' }],
        xl: ['1.1875rem', { lineHeight: '1.65rem' }],
        '2xl': ['1.375rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.625rem', { lineHeight: '1.9rem' }],
        '4xl': ['1.875rem', { lineHeight: '2.1rem' }],
        '5xl': ['2.25rem', { lineHeight: '1' }],
        '6xl': ['2.75rem', { lineHeight: '1' }],
        'body-sm': ['var(--font-size-sm)', { lineHeight: 'var(--leading-normal)' }],
        body: ['var(--font-size-base)', { lineHeight: 'var(--leading-relaxed)' }],
        'body-lg': ['var(--font-size-lg)', { lineHeight: 'var(--leading-relaxed)' }],
        title: ['var(--font-size-xl)', { lineHeight: 'var(--leading-tight)' }],
        'page-title': ['var(--font-size-3xl)', { lineHeight: 'var(--leading-tight)' }],
        display: ['var(--font-size-display)', { lineHeight: 'var(--leading-tight)' }],
        'stat-value': ['var(--font-size-2xl)', { lineHeight: 'var(--leading-tight)' }],
      },
      lineHeight: {
        tight: 'var(--leading-tight)',
        normal: 'var(--leading-normal)',
        relaxed: 'var(--leading-relaxed)',
      },
      letterSpacing: {
        eyebrow: 'var(--tracking-eyebrow)',
      },
    },
  },
  plugins: [],
};
