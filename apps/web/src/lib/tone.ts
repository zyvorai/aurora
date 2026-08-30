/**
 * Literal Tailwind class strings per Tone -- iPhone 17 colorway mapping:
 * sky=Mist Blue, violet/pink=Lavender, emerald=Sage, teal=Deep Blue, amber/rust=Cosmic Orange.
 * Kept as a static object so Tailwind's content scanner sees every class name.
 */
import type { Tone } from '@/components/layout/PageHero';

interface ToneClassSet {
  border: string;
  text: string;
  bg: string;
  /** Solid full-opacity fill + readable text, for active tab/pill treatments. */
  solid: string;
  hoverBorder: string;
  dot: string;
}

export const TONE_CLASSES: Record<Tone, ToneClassSet> = {
  sky: {
    border: 'border-accent-blue',
    text: 'text-accent-blue',
    bg: 'bg-accent-blue/15',
    solid: 'bg-accent-blue text-white',
    hoverBorder: 'hover:border-accent-blue/60',
    dot: 'bg-accent-blue',
  },
  violet: {
    border: 'border-accent-purple',
    text: 'text-accent-purple',
    bg: 'bg-accent-purple/15',
    solid: 'bg-accent-purple text-white',
    hoverBorder: 'hover:border-accent-purple/60',
    dot: 'bg-accent-purple',
  },
  emerald: {
    border: 'border-accent-teal',
    text: 'text-accent-teal',
    bg: 'bg-accent-teal/15',
    solid: 'bg-accent-teal text-white',
    hoverBorder: 'hover:border-accent-teal/60',
    dot: 'bg-accent-teal',
  },
  amber: {
    border: 'border-primary',
    text: 'text-primary',
    bg: 'bg-primary/15',
    solid: 'bg-primary text-primary-foreground',
    hoverBorder: 'hover:border-primary/60',
    dot: 'bg-primary',
  },
  pink: {
    border: 'border-accent-pink',
    text: 'text-accent-pink',
    bg: 'bg-accent-pink/15',
    solid: 'bg-accent-pink text-white',
    hoverBorder: 'hover:border-accent-pink/60',
    dot: 'bg-accent-pink',
  },
  teal: {
    border: 'border-accent-deep-blue',
    text: 'text-accent-deep-blue',
    bg: 'bg-accent-deep-blue/15',
    solid: 'bg-accent-deep-blue text-white',
    hoverBorder: 'hover:border-accent-deep-blue/60',
    dot: 'bg-accent-deep-blue',
  },
  rust: {
    border: 'border-primary',
    text: 'text-primary',
    bg: 'bg-primary/15',
    solid: 'bg-primary text-primary-foreground',
    hoverBorder: 'hover:border-primary/60',
    dot: 'bg-primary',
  },
};

/** Stable rotation for contexts with no inherent category (e.g. a plain product grid). */
export const TONE_ROTATION: Tone[] = ['sky', 'pink', 'emerald', 'violet', 'teal', 'amber'];
