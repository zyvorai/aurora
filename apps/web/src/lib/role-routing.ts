/**
 * Role-based default landing — persona-first navigation per composition plan.
 * @see docs/multi-agent-composition-plan.md §9
 */

import { products } from '@/lib/api';

/** RBAC roles returned by the API (`/auth/login`, `/auth/me`). */
export type AppRole = 'admin' | 'editor' | 'approver' | 'viewer';

export type PersonaPath = 'brief' | 'sales' | 'marketing' | 'partner' | 'forge';

/** Default persona view after login or when opening a product. */
export const ROLE_DEFAULT_PERSONA: Record<AppRole, PersonaPath> = {
  admin: 'forge',
  approver: 'brief',
  viewer: 'brief',
  editor: 'sales',
};

const PERSONA_LABELS: Record<PersonaPath, string> = {
  brief: 'Executive Brief',
  sales: 'Sales Workspace',
  marketing: 'Marketing Hub',
  partner: 'Partner Enablement',
  forge: 'Full Forge',
};

const PERSONA_DESCRIPTIONS: Record<PersonaPath, string> = {
  brief: 'KPIs, GTM readiness, and risks — no LLM at page load.',
  sales: 'Qualified leads, outreach, and pipeline actions.',
  marketing: 'ICP, campaigns, and content workflows.',
  partner: 'Product facts, templates, and deal registration.',
  forge: 'Ingest, agents, and all workflow tabs.',
};

export function normalizeRole(role: string | null | undefined): AppRole {
  if (role === 'admin' || role === 'editor' || role === 'approver' || role === 'viewer') {
    return role;
  }
  return 'viewer';
}

export function defaultPersonaForRole(role: string | null | undefined): PersonaPath {
  return ROLE_DEFAULT_PERSONA[normalizeRole(role)];
}

export function personaHref(productId: string, persona: PersonaPath): string {
  if (persona === 'forge') return `/products/${productId}`;
  return `/products/${productId}/${persona}`;
}

export function defaultProductRoute(productId: string, role: string | null | undefined): string {
  return personaHref(productId, defaultPersonaForRole(role));
}

export function personaLabel(persona: PersonaPath): string {
  return PERSONA_LABELS[persona];
}

export function personaDescription(persona: PersonaPath): string {
  return PERSONA_DESCRIPTIONS[persona];
}

/** Where to send the user immediately after auth. */
export async function resolvePostLoginRoute(role: string | null | undefined): Promise<string> {
  try {
    const list = await products.list();
    if (list.length === 1) {
      return defaultProductRoute(list[0].id, role);
    }
  } catch {
    // fall through to dashboard
  }
  return '/dashboard';
}

export interface DashboardActions {
  primary: { label: string; href: (id: string) => string };
  secondary: { label: string; href: (id: string) => string };
}

export function dashboardActionsForRole(role: string | null | undefined): DashboardActions {
  const persona = defaultPersonaForRole(role);
  const primaryPersona = persona;
  let secondaryPersona: PersonaPath = 'brief';

  if (persona === 'brief') secondaryPersona = 'forge';
  else if (persona === 'forge') secondaryPersona = 'brief';
  else secondaryPersona = 'forge';

  return {
    primary: {
      label: `Open ${personaLabel(primaryPersona)}`,
      href: (id) => personaHref(id, primaryPersona),
    },
    secondary: {
      label: personaLabel(secondaryPersona),
      href: (id) => personaHref(id, secondaryPersona),
    },
  };
}

export function dashboardSubtitle(role: string | null | undefined): string {
  const persona = defaultPersonaForRole(role);
  return `Your default workspace is ${personaLabel(persona)} — ${personaDescription(persona)}`;
}

export function readStoredRole(): AppRole | null {
  if (typeof window === 'undefined') return null;
  return normalizeRole(localStorage.getItem('role'));
}

export function storeAuthSession(token: string, tenantId: string, role: string): void {
  localStorage.setItem('token', token);
  localStorage.setItem('tenant_id', tenantId);
  localStorage.setItem('role', normalizeRole(role));
}

export function clearAuthSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('tenant_id');
  localStorage.removeItem('role');
}
