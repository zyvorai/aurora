/**
 * Single source of truth for the desktop shell's navigation -- feeds the menubar,
 * Finder-style sidebar, dock, Mission Control, and command palette simultaneously
 * (mirrors hyper2kvm's navigation/h2kNav.tsx pattern). Adding a route to the app means
 * adding one entry here, not four separate places.
 */

import {
  Activity,
  Building2,
  Handshake,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  Settings,
  ShieldAlert,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { AppRole, PersonaPath } from '@/lib/role-routing';
import { personaHref, personaLabel } from '@/lib/role-routing';
import type { Tone } from '@/components/layout/PageHero';

export type NavGroupId = 'home' | 'workspace' | 'system';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Resolves the href. Workspace items need productId; others ignore it. */
  href: (productId: string) => string;
  /** Omit = visible to every role. */
  roles?: AppRole[];
  /** Shown in the dock's curated subset. */
  inDock?: boolean;
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  /** Non-collapsible groups are always expanded (the sidebar's "Favorites" analog). */
  collapsible: boolean;
  items: NavItem[];
}

const WORKSPACE_PERSONAS: PersonaPath[] = ['brief', 'sales', 'pipeline', 'marketing', 'partner', 'forge'];

export const WORKSPACE_ICONS: Record<PersonaPath, LucideIcon> = {
  brief: LayoutDashboard,
  sales: Users,
  pipeline: Kanban,
  marketing: Megaphone,
  partner: Handshake,
  forge: LayoutGrid,
};

/** iPhone 17 colorway accents per persona (Mist Blue / Sage / Lavender / Cosmic Orange / Deep Blue). */
export const WORKSPACE_COLORS: Record<PersonaPath, Tone> = {
  brief: 'sky',
  sales: 'emerald',
  pipeline: 'violet',
  marketing: 'pink',
  partner: 'teal',
  forge: 'amber',
};

/**
 * Full nav model. `hasProduct` gates whether the Workspace group is populated (it
 * needs a productId to build hrefs, same conditional-group pattern hyper2kvm uses for
 * its per-context nav groups) -- pass `false` for pages outside `/products/[id]/*`.
 */
export function getNavGroups(hasProduct: boolean, role: AppRole | null): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: 'home',
      label: 'Home',
      collapsible: false,
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: Building2, href: () => '/dashboard' },
      ],
    },
  ];

  if (hasProduct) {
    groups.push({
      id: 'workspace',
      label: 'Workspace',
      collapsible: true,
      items: WORKSPACE_PERSONAS.map((persona) => ({
        id: persona,
        label: personaLabel(persona),
        icon: WORKSPACE_ICONS[persona],
        href: (productId: string) => personaHref(productId, persona),
        inDock: persona === 'brief' || persona === 'sales' || persona === 'pipeline' || persona === 'marketing',
      })),
    });
  }

  const systemItems: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: Settings, href: () => '/dashboard/settings', inDock: true },
    { id: 'audit', label: 'Audit Log', icon: Activity, href: () => '/dashboard/audit', inDock: true },
    { id: 'agents', label: 'Agent Registry', icon: Users, href: () => '/dashboard/agents', inDock: true },
    {
      id: 'portal-accounts',
      label: 'Portal Accounts',
      icon: Handshake,
      href: () => '/dashboard/admin/portal-accounts',
      roles: ['admin'],
    },
    {
      id: 'sales-activity',
      label: 'Sales Activity',
      icon: TrendingUp,
      href: () => '/dashboard/admin/sales-activity',
      roles: ['admin'],
    },
    {
      id: 'tickets',
      label: 'Support Tickets',
      icon: LifeBuoy,
      href: () => '/dashboard/admin/tickets',
      roles: ['admin'],
    },
    {
      id: 'danger',
      label: 'Danger Zone',
      icon: ShieldAlert,
      href: () => '/dashboard/admin/danger',
      roles: ['admin'],
    },
    {
      id: 'workflow-stages',
      label: 'Workflow Stages',
      icon: Workflow,
      href: () => '/dashboard/admin/workflow-stages',
      roles: ['admin'],
    },
  ];

  groups.push({
    id: 'system',
    label: 'System',
    collapsible: true,
    items: role ? systemItems.filter((item) => !item.roles || item.roles.includes(role)) : systemItems.filter((item) => !item.roles),
  });

  return groups;
}

/** Curated subset shown in the dock -- Dashboard plus each item with `inDock: true`. */
export function getDockItems(hasProduct: boolean, role: AppRole | null): NavItem[] {
  return getNavGroups(hasProduct, role)
    .flatMap((g) => g.items)
    .filter((item) => item.inDock || item.id === 'dashboard');
}

/** Flat list for the command palette and Mission Control, grouped by section label. */
export function getFlatNavItems(hasProduct: boolean, role: AppRole | null): { group: string; item: NavItem }[] {
  return getNavGroups(hasProduct, role).flatMap((g) => g.items.map((item) => ({ group: g.label, item })));
}
