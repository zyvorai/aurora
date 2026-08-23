import {
  LayoutGrid, MessageCircleQuestion, Target, FileText, MessagesSquare,
  Send, Blocks, FileSignature, Rocket, BarChart3, Building2, Users,
  ShieldCheck, Sparkles, Zap, Database, Globe, Compass, Handshake, TrendingUp,
  type LucideIcon,
} from 'lucide-react';

/**
 * Fixed icon allow-list for tenant-defined custom workflow stages -- kept in sync
 * with apps/api/gtm_api/routers/admin.py's ALLOWED_STAGE_ICONS set (same keys). A
 * stage stores just the string key; both the admin editor's icon picker and
 * ForgePage's stage renderer resolve it through this same map, so a stored key can
 * never resolve to something unexpected.
 */
export const ALLOWED_STAGE_ICONS: Record<string, LucideIcon> = {
  'layout-grid': LayoutGrid,
  'message-circle-question': MessageCircleQuestion,
  target: Target,
  'file-text': FileText,
  'messages-square': MessagesSquare,
  send: Send,
  blocks: Blocks,
  'file-signature': FileSignature,
  rocket: Rocket,
  'bar-chart-3': BarChart3,
  'building-2': Building2,
  users: Users,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  zap: Zap,
  database: Database,
  globe: Globe,
  compass: Compass,
  handshake: Handshake,
  'trending-up': TrendingUp,
};

/** The only agent actions a custom stage's `agent_action` block may invoke -- kept in
 * sync with admin.py's ALLOWED_STAGE_ACTIONS and ForgePage.tsx's AgentTaskId union. */
export const ALLOWED_STAGE_ACTIONS = [
  'query', 'strategy', 'content', 'outreach', 'architect', 'proposal', 'analytics',
] as const;

export const STAGE_ACTION_LABELS: Record<(typeof ALLOWED_STAGE_ACTIONS)[number], string> = {
  query: 'Ask a question',
  strategy: 'Generate GTM strategy',
  content: 'Generate content',
  outreach: 'Draft outreach',
  architect: 'Solution architect Q&A',
  proposal: 'Generate proposal',
  analytics: 'View analytics',
};
