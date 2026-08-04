/** Agent task metadata for Forge long-running actions (no React — safe for any import). */

export type AgentTaskId =
  | 'ingest'
  | 'understand'
  | 'strategy'
  | 'content'
  | 'outreach'
  | 'architect'
  | 'proposal'
  | 'query'
  | 'analytics';

export const AGENT_TASK_CONFIG: Record<
  AgentTaskId,
  { title: string; subtitle: string; steps: string[]; hint?: string }
> = {
  ingest: {
    title: 'Crawling & ingesting',
    subtitle: 'Discovering and indexing product documentation',
    steps: ['Discovering pages', 'Fetching content', 'Chunking & embedding', 'Updating search index'],
    hint: 'Large sites can take several minutes.',
  },
  understand: {
    title: 'Building product profile',
    subtitle: 'Extracting capabilities, ICP, and value props',
    steps: ['Searching documentation', 'Extracting product facts', 'Structuring profile', 'Validating fields'],
  },
  strategy: {
    title: 'Generating GTM strategy',
    subtitle: 'ICP, personas, positioning, and content calendar',
    steps: ['Gathering multi-source context', 'Analyzing market fit', 'Drafting strategy', 'Building persona map'],
    hint: 'Local LLMs may take 5–15 minutes.',
  },
  content: {
    title: 'Creating content',
    subtitle: 'Drafting grounded marketing copy',
    steps: ['Retrieving relevant docs', 'Drafting content', 'Checking citations'],
  },
  outreach: {
    title: 'Generating outreach',
    subtitle: 'Personalized email and follow-up sequence',
    steps: [
      'Fetching prospect website',
      'Analyzing company & pain points',
      'Drafting personalized email',
      'Building follow-up sequence',
    ],
    hint: 'Analyzing the URL and drafting with your product profile.',
  },
  architect: {
    title: 'Running solution architect',
    subtitle: 'Technical answer, deployment plan, and diagram',
    steps: ['Gathering context', 'Searching documentation', 'Drafting architecture', 'Generating Mermaid diagram'],
    hint: 'Complex questions can take a few minutes.',
  },
  proposal: {
    title: 'Generating proposal',
    subtitle: 'SOW, ROI analysis, and timeline',
    steps: [
      'Gathering CRM & product context',
      'Drafting executive summary',
      'Writing statement of work',
      'Estimating ROI & timeline',
    ],
    hint: 'Pulls pipeline and brief data for richer proposals.',
  },
  query: {
    title: 'Answering question',
    subtitle: 'Grounded response from multiple sources',
    steps: ['Searching documentation', 'Checking CRM & analytics', 'Generating answer'],
  },
  analytics: {
    title: 'Loading analytics',
    subtitle: 'Funnel, metrics, and knowledge gaps',
    steps: ['Aggregating events', 'Computing funnel', 'Preparing report'],
  },
};

export function taskButtonLabel(
  activeTask: AgentTaskId | null,
  loading: boolean,
  idle: string,
  forAction?: AgentTaskId,
): string {
  if (!loading || !activeTask) return idle;
  if (forAction !== undefined && activeTask !== forAction) return idle;
  const labels: Partial<Record<AgentTaskId, string>> = {
    outreach: 'Generating…',
    strategy: 'Generating…',
    proposal: 'Generating…',
    architect: 'Thinking…',
    ingest: 'Processing…',
    understand: 'Building…',
    query: 'Asking…',
    analytics: 'Loading…',
    content: 'Creating…',
  };
  return labels[activeTask] ?? 'Working…';
}

export function formatTaskElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}
