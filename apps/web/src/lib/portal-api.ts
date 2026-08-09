import { resolveApiBase } from './api-base';
import { getPortalToken } from './portal-auth';

async function baseRequest<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  // Let the browser set its own multipart boundary for FormData bodies -- forcing
  // application/json here would break file uploads.
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
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

/** Proof-of-business document upload -- unauthenticated (the account isn't approved/
 * tokened yet), the account_id itself (a random UUID returned only to the applicant)
 * is the only thing gating it, mirroring the backend's design. */
function portalUploadRequest<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  return baseRequest<T>(`/portal${path}`, null, { method: 'POST', body: formData });
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

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  tenant_id: string;
  customer_account_id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketWithCustomer extends Ticket {
  customer_email: string;
  customer_company_name?: string | null;
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
  proof_document_key?: string | null;
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
  proof_document_key?: string | null;
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

  updateMe: (req: { company_name?: string; contact_name?: string }) =>
    portalRequest<CustomerAccount>('/customer/me', { method: 'PATCH', body: JSON.stringify(req) }),

  createTicket: (req: { subject: string; description: string; priority?: string }) =>
    portalRequest<Ticket>('/customer/tickets', { method: 'POST', body: JSON.stringify(req) }),

  myTickets: () => portalRequest<Ticket[]>('/customer/tickets'),

  getTicket: (ticketId: string) => portalRequest<Ticket>(`/customer/tickets/${ticketId}`),
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

  updateMe: (req: { company_name?: string; contact_name?: string }) =>
    portalRequest<ResellerAccount>('/reseller/me', { method: 'PATCH', body: JSON.stringify(req) }),

  registerDeal: (req: { product_id: string; company_name: string; domain?: string; industry?: string; company_size?: string; geo?: string }) =>
    portalRequest<DealRegistration>('/reseller/deals', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  myDeals: () => portalRequest<DealRegistration[]>('/reseller/deals'),

  uploadDocument: (accountId: string, file: File) =>
    portalUploadRequest<{ proof_document_key: string }>(`/reseller/signup/${accountId}/document`, file),
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

  updateMe: (req: { contact_name?: string; territory?: string }) =>
    portalRequest<SalesPersonAccount>('/salesperson/me', { method: 'PATCH', body: JSON.stringify(req) }),

  myPipeline: () => portalRequest<SalesPersonPipeline>('/salesperson/my-pipeline'),

  uploadDocument: (accountId: string, file: File) =>
    portalUploadRequest<{ proof_document_key: string }>(`/salesperson/signup/${accountId}/document`, file),
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

  getResellerDocumentUrl: (accountId: string) =>
    adminPortalRequest<{ url: string }>(`/reseller/accounts/${accountId}/document`),

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

  getSalesPersonDocumentUrl: (accountId: string) =>
    adminPortalRequest<{ url: string }>(`/salesperson/accounts/${accountId}/document`),

  salesActivity: () => adminPortalRequest<SalesPersonActivity[]>('/salesperson/activity'),

  listAllTickets: (statusFilter?: string) => {
    const query = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
    return adminPortalRequest<TicketWithCustomer[]>(`/customer/admin/tickets${query}`);
  },

  updateTicketStatus: (ticketId: string, status: TicketStatus) =>
    adminPortalRequest<Ticket>(`/customer/admin/tickets/${ticketId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
};

export interface SalesPersonActivity {
  salesperson: SalesPersonAccount;
  leads: SalesPersonLead[];
  opportunities: SalesPersonOpportunity[];
}
