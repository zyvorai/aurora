/**
 * Literal Tailwind class strings per Tone -- kept as a static object (not
 * template-built) so Tailwind's content scanner can see every class name; a
 * dynamically-built string like `border-${tone}` would get silently purged
 * from the production build. Pairs with the .tahoe-stat-{tone} / .tahoe-icon-badge-{tone}
 * CSS classes in globals.css and nav-data.ts's WORKSPACE_COLORS.
 */
import type { Tone } from '@/components/layout/PageHero';

interface ToneClassSet {
  border: string;
  text: string;
  bg: string;
  /** Solid full-opacity fill + readable text, for active tab/pill treatments. */
  solid: string;
  /** Fully literal "hover:border-{color}/60" class (not built with a template
   * string -- see note above about why that would get purged from the production build). */
  hoverBorder: string;
  /** Fully literal, non-opacity dot/swatch background (e.g. dashboard card accent). */
  dot: string;
}

export const TONE_CLASSES: Record<Tone, ToneClassSet> = {
  sky: { border: 'border-accent-blue', text: 'text-accent-blue', bg: 'bg-accent-blue/15', solid: 'bg-accent-blue text-white', hoverBorder: 'hover:border-accent-blue/60', dot: 'bg-accent-blue' },
  violet: { border: 'border-accent-purple', text: 'text-accent-purple', bg: 'bg-accent-purple/15', solid: 'bg-accent-purple text-white', hoverBorder: 'hover:border-accent-purple/60', dot: 'bg-accent-purple' },
  emerald: { border: 'border-success', text: 'text-success', bg: 'bg-success/15', solid: 'bg-success text-white', hoverBorder: 'hover:border-success/60', dot: 'bg-success' },
  amber: { border: 'border-warning', text: 'text-warning', bg: 'bg-warning/15', solid: 'bg-warning text-white', hoverBorder: 'hover:border-warning/60', dot: 'bg-warning' },
  pink: { border: 'border-accent-pink', text: 'text-accent-pink', bg: 'bg-accent-pink/15', solid: 'bg-accent-pink text-white', hoverBorder: 'hover:border-accent-pink/60', dot: 'bg-accent-pink' },
  teal: { border: 'border-accent-teal', text: 'text-accent-teal', bg: 'bg-accent-teal/15', solid: 'bg-accent-teal text-white', hoverBorder: 'hover:border-accent-teal/60', dot: 'bg-accent-teal' },
  rust: { border: 'border-primary', text: 'text-primary', bg: 'bg-primary/15', solid: 'bg-primary text-primary-foreground', hoverBorder: 'hover:border-primary/60', dot: 'bg-primary' },
};

/** Stable rotation for contexts with no inherent category (e.g. a plain product grid). */
export const TONE_ROTATION: Tone[] = ['sky', 'pink', 'emerald', 'violet', 'teal', 'amber'];
