const DEFAULT_TIMEOUT_MS = 60_000;
/** Agent/LLM calls (ingest, profile, strategy) — no client timeout; local models can take 15+ min. */
const AGENT_TIMEOUT_MS = 0;

function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/** Direct API URL in dev — avoids Next.js rewrite proxy ECONNRESET on long ingest. */
function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configured) return configured;

  if (typeof window !== 'undefined' && isLocalDevHost(window.location.hostname)) {
    return 'http://127.0.0.1:8000/api/v1';
  }

  return '/api';
}

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
        'Connection to API lost. Ensure the API is running (make start) and Ollama is up (ollama serve). Check .logs/api.log.',
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

  ingest(id: string): Promise<{ job_id: string; status: string; message: string }> {
    return request(`/products/${id}/ingest`, { method: 'POST', body: '{}', timeoutMs: AGENT_TIMEOUT_MS });
  },

  understand(id: string): Promise<{ profile: Record<string, unknown>; status: string }> {
    return request(`/products/${id}/understand`, { method: 'POST', body: '{}', timeoutMs: AGENT_TIMEOUT_MS });
  },

  query(id: string, question: string): Promise<{
    answer: string;
    citations: Array<{ chunk_id: string; document_title: string; excerpt: string; url?: string }>;
    confidence: number;
    grounded: boolean;
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
  }> {
    return request(`/products/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, session_id }),
    });
  },

  outreach(
    id: string,
    params: { company_url: string; target_persona?: string; campaign_name?: string },
  ): Promise<Record<string, unknown>> {
    return request(`/products/${id}/outreach`, {
      method: 'POST',
      body: JSON.stringify({
        company_url: params.company_url,
        target_persona: params.target_persona ?? 'CTO',
        campaign_name: params.campaign_name,
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

  artifacts(id: string): Promise<Artifact[]> {
    return request<Artifact[]>(`/products/${id}/artifacts`);
  },

  refresh(id: string): Promise<Record<string, unknown>> {
    return request(`/products/${id}/refresh`, { method: 'POST', body: '{}' });
  },
};
