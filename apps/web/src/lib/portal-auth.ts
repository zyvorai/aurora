/** Session storage for external portal accounts (customer/reseller/salesperson) --
 * deliberately separate keys from role-routing.ts's token/tenant_id/role, so an
 * internal-employee session and a portal session can never be confused with each other.
 * One portal session at a time per browser (a single "portal_token" key) -- being logged
 * into two portal types simultaneously in one browser is an edge case not worth the
 * storage complexity for this phase. */

export type PortalType = 'customer' | 'reseller' | 'salesperson';

const PORTAL_TOKEN_KEY = 'portal_token';
const PORTAL_TYPE_KEY = 'portal_type';
const PORTAL_ACCOUNT_ID_KEY = 'portal_account_id';
const PORTAL_TENANT_ID_KEY = 'portal_tenant_id';
const PORTAL_TENANT_SLUG_KEY = 'portal_tenant_slug';

export function getPortalToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function getPortalType(): PortalType | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PORTAL_TYPE_KEY) as PortalType | null;
}

export function storePortalSession(
  token: string,
  portalType: PortalType,
  accountId: string,
  tenantId: string,
  tenantSlug: string,
): void {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
  localStorage.setItem(PORTAL_TYPE_KEY, portalType);
  localStorage.setItem(PORTAL_ACCOUNT_ID_KEY, accountId);
  localStorage.setItem(PORTAL_TENANT_ID_KEY, tenantId);
  localStorage.setItem(PORTAL_TENANT_SLUG_KEY, tenantSlug);
}

export function getPortalTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PORTAL_TENANT_SLUG_KEY);
}

export function clearPortalSession(): void {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
  localStorage.removeItem(PORTAL_TYPE_KEY);
  localStorage.removeItem(PORTAL_ACCOUNT_ID_KEY);
  localStorage.removeItem(PORTAL_TENANT_ID_KEY);
  localStorage.removeItem(PORTAL_TENANT_SLUG_KEY);
}
