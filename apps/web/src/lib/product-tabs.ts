import {
  BarChart3,
  Blocks,
  FileSignature,
  FileText,
  LayoutGrid,
  MessageCircleQuestion,
  MessagesSquare,
  Rocket,
  Send,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { Tone } from '@/components/layout/PageHero';

/** Single source for the product workspace tabs: ForgePage renders them and ProductConsoleShell's rail lists the `surface` ones. */
export type FixedTab = 'overview' | 'query' | 'strategy' | 'content' | 'chat' | 'outreach' | 'architect' | 'proposal' | 'publish' | 'analytics';
// Custom (tenant-defined) stages use a `custom:<stageId>` tab key alongside the fixed ones.
export type Tab = FixedTab | string;

export interface TabDef {
  key: FixedTab;
  label: string;
  icon: LucideIcon;
  /** Also listed under "Surfaces" in the left rail. */
  surface?: boolean;
}

// macOS/iOS-Settings-style: each tab gets a small colored icon tile, each group a tone.
export const TAB_GROUPS: { label: string; tone: Tone; tabs: TabDef[] }[] = [
  {
    label: 'Foundation', tone: 'sky',
    tabs: [
      { key: 'overview', label: 'Overview', icon: LayoutGrid },
      { key: 'query', label: 'Q&A', icon: MessageCircleQuestion, surface: true },
    ],
  },
  {
    label: 'GTM', tone: 'violet',
    tabs: [
      { key: 'strategy', label: 'Strategy', icon: Target },
      { key: 'content', label: 'Content', icon: FileText, surface: true },
    ],
  },
  {
    label: 'Revenue', tone: 'emerald',
    tabs: [
      { key: 'chat', label: 'Sales Chat', icon: MessagesSquare, surface: true },
      { key: 'outreach', label: 'Outreach', icon: Send },
      { key: 'architect', label: 'Architect', icon: Blocks, surface: true },
      { key: 'proposal', label: 'Proposal', icon: FileSignature },
    ],
  },
  { label: 'Distribution', tone: 'pink', tabs: [{ key: 'publish', label: 'Publish', icon: Rocket }] },
  { label: 'Intelligence', tone: 'teal', tabs: [{ key: 'analytics', label: 'Analytics', icon: BarChart3, surface: true }] },
];

export const SURFACES = TAB_GROUPS.flatMap((g) => g.tabs.filter((t) => t.surface));
