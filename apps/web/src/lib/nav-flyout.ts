export type FlyLink = {
  label: string;
  to: string;
  sub?: string;
};

export type FlyGroup = {
  heading: string;
  lead?: boolean;
  links: FlyLink[];
};

export type FlyPanel = {
  key: string;
  groups: FlyGroup[];
};

export const NAV_FLYOUT_PANELS: FlyPanel[] = [
  {
    key: 'product',
    groups: [
      {
        heading: 'Overview',
        lead: true,
        links: [{ label: 'All features', to: '/features', sub: 'Full platform tour' }],
      },
      {
        heading: 'Capabilities',
        links: [
          { label: 'Auto-discovery', to: '/features#discover', sub: 'Crawl a URL, build a profile' },
          { label: 'Grounded knowledge', to: '/features#grounded', sub: 'Cited answers from your docs' },
          { label: 'Background agents', to: '/features#agents', sub: 'Long-running GTM work' },
          { label: 'Omnichannel publishing', to: '/features#publish', sub: 'LinkedIn, X, email, and more' },
        ],
      },
      {
        heading: 'Agents',
        links: [
          { label: 'Marketing agents', to: '/features#agents' },
          { label: 'Sales agents', to: '/features#agents' },
          { label: 'Solution agents', to: '/features#agents' },
          { label: 'Supervisor orchestration', to: '/features#orchestrate' },
        ],
      },
    ],
  },
  {
    key: 'platform',
    groups: [
      {
        heading: 'Workspace',
        lead: true,
        links: [{ label: 'Multi-tenant workspaces', to: '/features#workspaces', sub: 'Role-based landings' }],
      },
      {
        heading: 'Infrastructure',
        links: [
          { label: 'Knowledge graph + RAG', to: '/features#grounded' },
          { label: 'Background task queue', to: '/features#agents' },
          { label: 'Executive briefs', to: '/features#agents' },
        ],
      },
      {
        heading: 'LLM providers',
        links: [
          { label: 'Ollama (dev)', to: '/features#llm', sub: 'Free local inference' },
          { label: 'OpenAI (prod)', to: '/features#llm', sub: 'GPT-4o per agent' },
        ],
      },
    ],
  },
  {
    key: 'portals',
    groups: [
      {
        heading: 'External users',
        links: [
          { label: 'Customer portal', to: '/portal/customer/login' },
          { label: 'Reseller portal', to: '/portal/reseller/login' },
          { label: 'Salesperson portal', to: '/portal/salesperson/login' },
        ],
      },
      {
        heading: 'Get started',
        links: [
          { label: 'Create workspace', to: '/login', sub: 'Onboard from a URL in minutes' },
        ],
      },
    ],
  },
];

export const NAV_FLYOUT_DIRECT_LINKS: FlyLink[] = [
  { label: 'Features', to: '/features' },
];

export const NAV_FLYOUT_TRIGGER_LABELS: Record<string, string> = {
  product: 'Product',
  platform: 'Platform',
  portals: 'Portals',
};

export const NAV_CTA_HREF = '/login';
export const NAV_CTA_LABEL = 'Get started';
