import { resolveApiBase } from './api-base';

const DEFAULT_TIMEOUT_MS = 60_000;
/** Agent/LLM calls (ingest, profile, strategy) — no client timeout; local models can take 15+ min. */
const AGENT_TIMEOUT_MS = 0;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timer =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  let response: Response;
  try {
    response = await fetch(`${resolveApiBase()}${path}`, {
      ...fetchOptions,
      headers,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Request timed out. Local LLM steps can take 10–20 minutes on first run — retry or check .logs/api.log.',
      );
    }
  if (err instanceof TypeError) {
      throw new Error(
        'Cannot reach the API at ' + resolveApiBase() + '. Run: make stop && make start',
      );
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

    if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? body.message ?? detail;
      if (typeof detail !== 'string') detail = JSON.stringify(detail);
    } catch {
      // ignore parse errors
    }
    if (response.status === 404 && path.includes('/brief')) {
      throw new Error(
        'Brief API not found. Restart the API to load Wave 0 routes: make stop && make start',
      );
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  tenant_id: string;
  user_id: string;
  role: string;
}

export interface Product {
  id: string;
  name: string;
  website_url?: string | null;
  description?: string | null;
  profile?: Record<string, unknown> | null;
  profile_status: string;
  created_at: string;
}

export interface ProductSource {
  id: string;
  source_type: string;
  url?: string | null;
  display_name?: string | null;
  storage_key?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  status: string;
  pages_discovered: number;
  pages_processed: number;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  last_crawled_at?: string | null;
  created_at: string;
}

export interface IngestResult {
  job_ids: string[];
  status: string;
  message: string;
  sources_queued: number;
  results?: Array<Record<string, unknown>>;
}

export interface Artifact {
  id: string;
  type: string;
  title: string;
  status: string;
  channel?: string | null;
  created_at: string;
}

export const auth = {
  register(data: {
    tenant_name: string;
    email: string;
    password: string;
    full_name?: string;
  }): Promise<TokenResponse> {
    return request<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login(data: { email: string; password: string }): Promise<TokenResponse> {
    return request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  me(): Promise<{ id: string; email: string; full_name: string; role: string; tenant_id: string }> {
    return request('/auth/me');
  },
};

export const products = {
  list(): Promise<Product[]> {
    return request<Product[]>('/products');
  },

  get(id: string): Promise<Product> {
    return request<Product>(`/products/${id}`);
  },

  create(data: { name: string; website_url?: string; description?: string }): Promise<Product> {
    return request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  ingest(
    id: string,
    options?: { source_ids?: string[]; force?: boolean; async_mode?: boolean },
  ): Promise<IngestResult> {
    const asyncMode = options?.async_mode ?? false;
    return request(`/products/${id}/ingest`, {
      method: 'POST',
      body: JSON.stringify({ ...options, async_mode: asyncMode }),
      timeoutMs: asyncMode ? DEFAULT_TIMEOUT_MS : AGENT_TIMEOUT_MS,
    });
  },

  listSources(id: string, options?: { timeoutMs?: number }): Promise<ProductSource[]> {
    return request<ProductSource[]>(`/products/${id}/sources`, {
      ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    });
  },

  addSource(
    id: string,
    data: {
      source_type: string;
      url?: string;
      display_name?: string;
      metadata?: Record<string, unknown>;
      github_token?: string;
    },
  ): Promise<ProductSource> {
    return request(`/products/${id}/sources`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async uploadSource(
    id: string,
    file: File,
    source_type: string,
    display_name?: string,
  ): Promise<ProductSource> {
    const form = new FormData();
    form.append('file', file);
    form.append('source_type', source_type);
    if (display_name) form.append('display_name', display_name);

    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${resolveApiBase()}/products/${id}/sources/upload`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = await response.json();
        detail = body.detail ?? detail;
      } catch { /* ignore */ }
      throw new Error(typeof detail === 'string' ? detail : 'Upload failed');
    }
    return response.json();
  },

  addDatabaseSource(
    id: string,
    data: {
      engine: string;
      host: string;
      port?: number;
      database: string;
      username: string;
      password: string;
      tables: string[];
      display_name?: string;
    },
  ): Promise<ProductSource> {
    return request(`/products/${id}/sources/database`, {
      method: 'POST',
      body: JSON.stringify({ ...data, read_only: true }),
    });
  },

  testDatabaseConnection(
    id: string,
    data: {
      engine: string;
      host: string;
      port?: number;
      database: string;
      username: string;
      password: string;
    },
  ): Promise<{ tables: string[] }> {
    return request(`/products/${id}/sources/database/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteSource(productId: string, sourceId: string): Promise<void> {
    return request(`/products/${productId}/sources/${sourceId}`, { method: 'DELETE' });
  },

  understand(id: string): Promise<{ profile: Record<string, unknown>; status: string }> {
    return request(`/products/${id}/understand`, { method: 'POST', body: '{}', timeoutMs: AGENT_TIMEOUT_MS });
  },

  query(id: string, question: string): Promise<{
    answer: string;
    citations: Array<{ chunk_id: string; document_title: string; excerpt: string; url?: string }>;
    confidence: number;
    grounded: boolean;
    sources_used?: string[];
  }> {
    return request(`/products/${id}/query`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },

  strategy(id: string, focus_areas: string[] = []): Promise<Record<string, unknown>> {
    return request(`/products/${id}/strategy`, {
      method: 'POST',
      body: JSON.stringify({ focus_areas }),
      timeoutMs: AGENT_TIMEOUT_MS,
    });
  },

  content(
    id: string,
    params: { content_type: string; topic: string; tone?: string; target_persona?: string },
  ): Promise<Record<string, unknown>> {
    return request(`/products/${id}/content`, {
      method: 'POST',
      body: JSON.stringify(params),
      timeoutMs: AGENT_TIMEOUT_MS,
    });
  },

  chat(id: string, message: string, session_id: string): Promise<{
    reply: string;
    citations: unknown[];
    grounded: boolean;
    lead_score?: number;
    suggested_actions?: string[];
    sources_used?: string[];
  }> {
    return request(`/products/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, session_id }),
    });
  },

  outreach(
    id: string,
    params: { company_url: string; target_persona?: string; campaign_name?: string; recipient_email?: string },
  ): Promise<Record<string, unknown>> {
    return request(`/products/${id}/outreach`, {
      method: 'POST',
      body: JSON.stringify({
        company_url: params.company_url,
        target_persona: params.target_persona ?? 'CTO',
        campaign_name: params.campaign_name,
        recipient_email: params.recipient_email,
      }),
      timeoutMs: AGENT_TIMEOUT_MS,
    });
  },

  architect(id: string, question: string, context?: string): Promise<Record<string, unknown>> {
    return request(`/products/${id}/architect`, {
      method: 'POST',
      body: JSON.stringify({ question, context }),
      timeoutMs: AGENT_TIMEOUT_MS,
    });
  },

  proposal(id: string, scope: string, include_pricing = true): Promise<Record<string, unknown>> {
    return request(`/products/${id}/proposals`, {
      method: 'POST',
      body: JSON.stringify({ scope, include_pricing }),
      timeoutMs: AGENT_TIMEOUT_MS,
    });
  },

  analytics(id: string): Promise<Record<string, unknown>> {
    return request(`/products/${id}/analytics`);
  },

  async downloadProposalExport(
    productId: string,
    artifactId: string,
    format: 'pdf' | 'docx' | 'pptx',
  ): Promise<void> {
    const token = getToken();
    const response = await fetch(
      `${resolveApiBase()}/products/${productId}/proposals/${artifactId}/export?format=${format}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!response.ok) {
      throw new Error(`Export failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proposal-${artifactId}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  artifacts(id: string): Promise<Artifact[]> {
    return request<Artifact[]>(`/products/${id}/artifacts`);
  },

  refresh(id: string): Promise<Record<string, unknown>> {
    return request(`/products/${id}/refresh`, { method: 'POST', body: '{}' });
  },

  brief(id: string): Promise<ExecutiveBrief> {
    return request<ExecutiveBrief>(`/products/${id}/brief`);
  },

  startOutboundSprint(
    id: string,
    params: {
      focus_industries?: string[];
      max_leads?: number;
      campaign_name?: string;
      company_url?: string;
      target_persona?: string;
    } = {},
  ): Promise<WorkflowRunAccepted> {
    return request<WorkflowRunAccepted>(`/products/${id}/workflows/outbound_sprint`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  pollWorkflow(runId: string): Promise<WorkflowRunStatus> {
    return request<WorkflowRunStatus>(`/workflows/runs/${runId}`);
  },

  pipelineLeads(id: string): Promise<PipelineLead[]> {
    return request<PipelineLead[]>(`/products/${id}/pipeline-leads`);
  },

  discoverLeads(
    id: string,
    params: { focus_industries?: string[]; max_leads?: number; csv_import?: string } = {},
  ): Promise<{ discovered_count: number; accounts: Array<Record<string, unknown>> }> {
    return request(`/products/${id}/discover-leads`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  qualifyLeads(
    id: string,
    params: { focus_industries?: string[] } = {},
  ): Promise<{ qualified_count: number; tier_a: number; leads: Array<Record<string, unknown>> }> {
    return request(`/products/${id}/qualify-leads`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  opportunities(id: string, stage?: string): Promise<Opportunity[]> {
    const qs = stage ? `?stage=${encodeURIComponent(stage)}` : '';
    return request<Opportunity[]>(`/products/${id}/opportunities${qs}`);
  },

  createOpportunity(
    id: string,
    data: { name: string; company?: string; stage?: string; amount?: number },
  ): Promise<Opportunity> {
    return request<Opportunity>(`/products/${id}/opportunities`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateOpportunityStage(
    productId: string,
    opportunityId: string,
    stage: string,
  ): Promise<Opportunity> {
    return request<Opportunity>(
      `/products/${productId}/opportunities/${opportunityId}/stage`,
      { method: 'PATCH', body: JSON.stringify({ stage }) },
    );
  },

  pipelineSummary(id: string): Promise<PipelineSummary> {
    return request<PipelineSummary>(`/products/${id}/pipeline-summary`);
  },

  startTechnicalEval(
    id: string,
    params: {
      opportunity_name: string;
      company?: string;
      question: string;
      scope: string;
      include_pricing?: boolean;
    },
  ): Promise<WorkflowRunAccepted> {
    return request<WorkflowRunAccepted>(`/products/${id}/workflows/technical_eval`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  startGenerateProposal(
    id: string,
    params: { scope: string; include_pricing?: boolean; opportunity_id?: string },
  ): Promise<WorkflowRunAccepted> {
    return request<WorkflowRunAccepted>(`/products/${id}/workflows/generate_proposal`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  insights(id: string): Promise<ProductInsights> {
    return request<ProductInsights>(`/products/${id}/insights`);
  },

  refreshInsights(id: string, force = false): Promise<Record<string, unknown>> {
    return request(`/products/${id}/refresh-insights?force=${force}`, { method: 'POST', body: '{}' });
  },

  accountHealth(id: string): Promise<AccountHealthRecord[]> {
    return request<AccountHealthRecord[]>(`/products/${id}/account-health`);
  },

  createSuccessPlan(id: string, opportunityId: string): Promise<SuccessPlanResponse> {
    return request(`/products/${id}/opportunities/${opportunityId}/success-plan`, { method: 'POST', body: '{}' });
  },

  refreshCsBriefs(id: string): Promise<Record<string, unknown>> {
    return request(`/products/${id}/refresh-cs-briefs`, { method: 'POST', body: '{}' });
  },

  getOpportunity(id: string, opportunityId: string): Promise<Opportunity> {
    return request(`/products/${id}/opportunities/${opportunityId}`);
  },
};

export interface SuccessPlanResponse {
  opportunity_id: string;
  health_score: number;
  status: string;
  playbook: Record<string, unknown>;
  cs_brief: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
}

export const audit = {
  list(): Promise<AuditLogEntry[]> {
    return request<AuditLogEntry[]>('/audit');
  },
};

export interface ApprovalResponse {
  id: string;
  artifact_id: string;
  status: string;
  reviewer_id: string | null;
  created_at: string;
}

export interface PublishResponse {
  channel_post_id: string;
  status: string;
  idempotency_key: string;
}

export const PUBLISH_CHANNELS = [
  'email', 'newsletter', 'linkedin', 'x', 'medium', 'devto', 'reddit', 'blog',
] as const;
export type PublishChannel = typeof PUBLISH_CHANNELS[number];

export interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  config: Record<string, unknown>;
}

export interface CampaignStatusReport {
  campaign_id: string;
  name: string;
  status: string;
  stored_status: string;
  campaign_type: string;
  channels: string[];
  focus_industries: string[];
  progress: Record<string, { target: number; actual: number }>;
  on_track: boolean;
  last_checked_at: string;
}

export const campaigns = {
  list(productId: string): Promise<Campaign[]> {
    return request(`/products/${productId}/campaigns`);
  },

  create(
    productId: string,
    data: { name: string; campaign_type?: string; template?: string; channels?: string[]; focus_industries?: string[] },
  ): Promise<Campaign> {
    return request(`/products/${productId}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  status(productId: string, campaignId: string): Promise<CampaignStatusReport> {
    return request(`/products/${productId}/campaigns/${campaignId}/status`);
  },
};

export interface AgentRegistryEntry {
  agent_id: string;
  display_name: string;
  compute_tier: string;
  async_required: boolean;
  implemented: boolean;
  model_key: string;
  description: string;
}

export interface AdminPlanInfo {
  plan: string;
  tenant_slug: string;
  features: { products: number; sso: boolean; audit: boolean; private_deploy: boolean };
  usage: { products_used: number; products_limit: number };
}

export interface SuppressionEntry {
  id: string;
  email: string;
  reason: string;
  created_at: string;
}

export const admin = {
  plan(): Promise<AdminPlanInfo> {
    return request('/admin/plan');
  },

  listSuppressions(): Promise<SuppressionEntry[]> {
    return request('/admin/suppression');
  },

  addSuppression(email: string, reason?: string): Promise<SuppressionEntry> {
    return request('/admin/suppression', {
      method: 'POST',
      body: JSON.stringify({ email, reason }),
    });
  },

  async exportData(): Promise<void> {
    const token = getToken();
    const response = await fetch(`${resolveApiBase()}/admin/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Export failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tenant-export.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  purge(confirm: string): Promise<{ status: string; tenant_id: string }> {
    return request('/admin/purge', {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    });
  },
};

export const agents = {
  registry(): Promise<AgentRegistryEntry[]> {
    return request('/agents/registry');
  },
};

export const artifacts = {
  approve(artifactId: string, data: { status: 'approved' | 'rejected'; comment?: string }): Promise<ApprovalResponse> {
    return request(`/artifacts/${artifactId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  publish(
    artifactId: string,
    data: { channel: PublishChannel; scheduled_at?: string; recipient?: string },
  ): Promise<PublishResponse> {
    return request(`/artifacts/${artifactId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ artifact_id: artifactId, ...data }),
    });
  },
};

export interface PipelineLead {
  account_id: string;
  company_name: string;
  domain?: string | null;
  industry?: string | null;
  score: number;
  tier: string;
  explanation?: string | null;
  factors?: Record<string, unknown>;
}

export interface ExecutiveBrief {
  product_id: string;
  product_name: string;
  profile_status: string;
  gtm_readiness: {
    ingest_started: boolean;
    ingest_complete: boolean;
    profile_built: boolean;
    strategy_ready: boolean;
    outreach_ready: boolean;
  };
  kpis: {
    leads: number;
    conversations: number;
    artifacts: number;
    agent_runs: number;
  };
  funnel: Record<string, number>;
  metrics: Record<string, number>;
  narrative: string;
  risks: string[];
  updated_at: string;
  compute_tier: string;
  narrative_llm?: string;
}

export interface WorkflowRunAccepted {
  workflow_run_id: string;
  status: string;
  poll_url: string;
}

export interface WorkflowRunStatus {
  id: string;
  workflow_name: string;
  status: string;
  steps: Array<{ name: string; status: string; error?: string }>;
  output_data: Record<string, unknown>;
  error_message?: string | null;
}

export interface Opportunity {
  id: string;
  name: string;
  company?: string | null;
  stage: string;
  amount?: number | null;
  probability: number;
  lead_id?: string | null;
  proposal_artifact_id?: string | null;
  architect_artifact_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PipelineSummary {
  total: number;
  by_stage: Record<string, number>;
  weighted_pipeline: number;
}

const OPPORTUNITY_STAGES = [
  'discovery',
  'qualification',
  'technical_eval',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

export { OPPORTUNITY_STAGES };

export interface ProductInsights {
  period: string;
  metrics: Record<string, unknown>;
  funnel: Record<string, number>;
  pipeline: {
    by_stage: Record<string, number>;
    total_opportunities: number;
    weighted_value: number;
  };
  campaigns: { total: number; active: number };
  compute_tier: string;
  narrative_llm?: string | null;
  narrative_fresh?: boolean;
  narrative_updated_at?: string | null;
  top_questions?: Array<{ question: string }>;
  knowledge_gaps?: Array<{ query: string }>;
}

export interface AccountHealthRecord {
  id: string;
  opportunity_id: string;
  health_score: number;
  status: string;
  metrics: Record<string, unknown>;
  playbook: Record<string, unknown>;
  cs_brief: Record<string, unknown>;
  last_cs_brief_at?: string | null;
}
