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
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
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
