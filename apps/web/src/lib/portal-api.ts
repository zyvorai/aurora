import { resolveApiBase } from './api-base';
import { getPortalToken } from './portal-auth';

async function baseRequest<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${resolveApiBase()}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach the API at ' + resolveApiBase());
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
      if (typeof detail !== 'string') detail = JSON.stringify(detail);
    } catch {
      // ignore parse errors
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Customer-facing calls (signup/login/me) — authenticated with the portal token. */
function portalRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return baseRequest<T>(`/portal${path}`, getPortalToken(), options);
}

/** Admin-facing calls (list/approve/reject) — authenticated with the INTERNAL employee
 * token (same localStorage key api.ts's request() reads), not the portal token, since
 * these are called by a logged-in tenant admin reviewing signups, not by the applicant. */
function adminPortalRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const employeeToken = typeof window === 'undefined' ? null : localStorage.getItem('token');
  return baseRequest<T>(`/portal${path}`, employeeToken, options);
}

export interface PortalSignupRequest {
  tenant_slug: string;
  product_id: string;
  email: string;
  password: string;
  company_name?: string;
  contact_name?: string;
}

export interface PortalSignupResponse {
  id: string;
  status: string;
  message: string;
}

export interface PortalTokenResponse {
  access_token: string;
  token_type: string;
  portal_type: string;
  account_id: string;
  tenant_id: string;
}

export interface CustomerAccount {
  id: string;
  tenant_id: string;
  product_id: string;
  email: string;
  company_name?: string | null;
  contact_name?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejected_reason?: string | null;
  created_at: string;
}

export interface ResellerSignupRequest {
  tenant_slug: string;
  email: string;
  password: string;
  company_name?: string;
  contact_name?: string;
  business_id?: string;
}

export interface ResellerAccount {
  id: string;
  tenant_id: string;
  email: string;
  company_name?: string | null;
  contact_name?: string | null;
  business_id?: string | null;
  margin_tier: string;
  authorized_product_ids?: string[] | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejected_reason?: string | null;
  created_at: string;
}

export interface DealRegistration {
  id: string;
  company_name: string;
  status: string;
  created_at: string;
}

export interface SalesPersonSignupRequest {
  tenant_slug: string;
  email: string;
  password: string;
  contact_name?: string;
  territory?: string;
}

export interface SalesPersonAccount {
  id: string;
  tenant_id: string;
  email: string;
  contact_name?: string | null;
  commission_rate: number;
  territory?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejected_reason?: string | null;
  created_at: string;
}

export interface SalesPersonLead {
  id: string;
  company?: string | null;
  name?: string | null;
  email?: string | null;
  title?: string | null;
  score: number;
  stage: string;
  created_at: string;
}

export interface SalesPersonOpportunity {
  id: string;
  name: string;
  company?: string | null;
  stage: string;
  amount?: number | null;
  probability: number;
  lead_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SalesPersonPipeline {
  leads: SalesPersonLead[];
  opportunities: SalesPersonOpportunity[];
}

export const portal = {
  signup: (req: PortalSignupRequest) =>
    portalRequest<PortalSignupResponse>('/customer/signup', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  login: (req: { tenant_slug: string; email: string; password: string }) =>
    portalRequest<PortalTokenResponse>('/customer/login', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  me: () => portalRequest<CustomerAccount>('/customer/me'),
};

export const resellerPortal = {
  signup: (req: ResellerSignupRequest) =>
    portalRequest<PortalSignupResponse>('/reseller/signup', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  login: (req: { tenant_slug: string; email: string; password: string }) =>
    portalRequest<PortalTokenResponse>('/reseller/login', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  me: () => portalRequest<ResellerAccount>('/reseller/me'),

  registerDeal: (req: { product_id: string; company_name: string; domain?: string; industry?: string; company_size?: string; geo?: string }) =>
    portalRequest<DealRegistration>('/reseller/deals', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  myDeals: () => portalRequest<DealRegistration[]>('/reseller/deals'),
};

export const salesPersonPortal = {
  signup: (req: SalesPersonSignupRequest) =>
    portalRequest<PortalSignupResponse>('/salesperson/signup', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  login: (req: { tenant_slug: string; email: string; password: string }) =>
    portalRequest<PortalTokenResponse>('/salesperson/login', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  me: () => portalRequest<SalesPersonAccount>('/salesperson/me'),

  myPipeline: () => portalRequest<SalesPersonPipeline>('/salesperson/my-pipeline'),
};

export const portalAdmin = {
  listAccounts: (statusFilter?: string) => {
    const query = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
    return adminPortalRequest<CustomerAccount[]>(`/customer/accounts${query}`);
  },

  approve: (accountId: string) =>
    adminPortalRequest<CustomerAccount>(`/customer/accounts/${accountId}/approve`, { method: 'POST' }),

  reject: (accountId: string, reason: string) =>
    adminPortalRequest<CustomerAccount>(`/customer/accounts/${accountId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  listResellerAccounts: (statusFilter?: string) => {
    const query = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
    return adminPortalRequest<ResellerAccount[]>(`/reseller/accounts${query}`);
  },

  approveReseller: (accountId: string) =>
    adminPortalRequest<ResellerAccount>(`/reseller/accounts/${accountId}/approve`, { method: 'POST' }),

  rejectReseller: (accountId: string, reason: string) =>
    adminPortalRequest<ResellerAccount>(`/reseller/accounts/${accountId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  listSalesPersonAccounts: (statusFilter?: string) => {
    const query = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
    return adminPortalRequest<SalesPersonAccount[]>(`/salesperson/accounts${query}`);
  },

  approveSalesPerson: (accountId: string) =>
    adminPortalRequest<SalesPersonAccount>(`/salesperson/accounts/${accountId}/approve`, { method: 'POST' }),

  rejectSalesPerson: (accountId: string, reason: string) =>
    adminPortalRequest<SalesPersonAccount>(`/salesperson/accounts/${accountId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
