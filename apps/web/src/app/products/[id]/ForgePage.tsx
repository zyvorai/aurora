'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { products, workflowStages, type Artifact, type ExecutiveBrief, type WorkflowStage } from '@/lib/api';
import { useIngestPolling } from '@/lib/useIngestPolling';
import { useWorkflowPolling } from '@/lib/useWorkflowPolling';
import { showToast } from '@/lib/toast';
import { readStoredRole } from '@/lib/role-routing';
import { uuid } from '@/lib/uuid';
import { workflowProgressPercent } from '@/lib/workflow-progress';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useProduct } from '@/context/ProductContext';
import { PageHero } from '@/components/layout/PageHero';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import ProductProfileView from '@/components/ProductProfileView';
import ResultPanel from '@/components/ResultPanel';
import { Markdown } from '@/components/ui/Markdown';
import ChatWidget from '@/components/ChatWidget';
import SourcesPanel from '@/components/sources/SourcesPanel';
import type { SourceKind } from '@/components/sources/AddSourceWizard';
import ArtifactList from '@/components/artifacts/ArtifactList';
import AgentTaskProgress from '@/components/AgentTaskProgress';
import { taskButtonLabel, type AgentTaskId } from '@/lib/agent-tasks';
import { cn } from '@/lib/cn';
import { Text, TextMuted, TextSmall } from '@/components/ui/Typography';
import { WORKSPACE_ICONS, WORKSPACE_COLORS } from '@/lib/nav-data';
import { SkeletonHero } from '@/components/ui/Skeleton';
import type { Tone } from '@/components/layout/PageHero';
import {
  LayoutGrid, MessageCircleQuestion, Target, FileText, MessagesSquare,
  Send, Blocks, FileSignature, Rocket, BarChart3, type LucideIcon,
} from 'lucide-react';
import { StageBlockRenderer } from '@/components/workflow/StageBlockRenderer';
import { StageChain } from '@/components/workflow/StageChain';
import { NextAction } from '@/components/workflow/NextAction';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { deriveChain, nextActionableStage, chainStageHref, chainStatusLabel, type ChainStageId } from '@/lib/chain';

type FixedTab = 'overview' | 'query' | 'strategy' | 'content' | 'chat' | 'outreach' | 'architect' | 'proposal' | 'publish' | 'analytics';
// Custom (tenant-defined) stages use a `custom:<stageId>` tab key alongside the 10
// fixed ones -- kept as a plain string rather than a template-literal union so
// TAB_GROUPS/switch-case logic below stays exactly as it was for the fixed tabs.
type Tab = FixedTab | string;

// macOS/iOS-Settings-style: each tab gets a small colored icon tile, each group a tone
// from the same iPhone-colorway palette used everywhere else (WORKSPACE_COLORS etc).
const TAB_GROUPS: { label: string; tone: Tone; tabs: { key: FixedTab; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Foundation', tone: 'sky',
    tabs: [
      { key: 'overview', label: 'Overview', icon: LayoutGrid },
      { key: 'query', label: 'Q&A', icon: MessageCircleQuestion },
    ],
  },
  {
    label: 'GTM', tone: 'violet',
    tabs: [
      { key: 'strategy', label: 'Strategy', icon: Target },
      { key: 'content', label: 'Content', icon: FileText },
    ],
  },
  {
    label: 'Revenue', tone: 'emerald',
    tabs: [
      { key: 'chat', label: 'Sales Chat', icon: MessagesSquare },
      { key: 'outreach', label: 'Outreach', icon: Send },
      { key: 'architect', label: 'Architect', icon: Blocks },
      { key: 'proposal', label: 'Proposal', icon: FileSignature },
    ],
  },
  { label: 'Distribution', tone: 'pink', tabs: [{ key: 'publish', label: 'Publish', icon: Rocket }] },
  { label: 'Intelligence', tone: 'teal', tabs: [{ key: 'analytics', label: 'Analytics', icon: BarChart3 }] },
];

const VALID_TABS = new Set<string>(TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.key)));

function parseTab(value: string | null): Tab {
  // Custom-stage tabs aren't known until fetched, so accept the `custom:` shape
  // on faith here -- selectTab/the sidebar only ever produce valid ids anyway,
  // and an unmatched custom id just renders nothing in the tab body below.
  if (value && (VALID_TABS.has(value) || value.startsWith('custom:'))) return value;
  return 'overview';
}

export default function ProductForgePageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { product, loading: productLoading } = useProduct();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')));
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<AgentTaskId | null>(null);
  const [taskDetail, setTaskDetail] = useState<string | undefined>();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState('');
  const [outreachUrl, setOutreachUrl] = useState('');
  const [outreachRecipient, setOutreachRecipient] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [architectQuestion, setArchitectQuestion] = useState('');
  const [proposalScope, setProposalScope] = useState('');
  const [refreshingKnowledge, setRefreshingKnowledge] = useState(false);
  const [generatingProposalAsync, setGeneratingProposalAsync] = useState(false);
  const [customStages, setCustomStages] = useState<WorkflowStage[]>([]);
  const [sourceOpenKind, setSourceOpenKind] = useState<SourceKind | undefined>(undefined);
  const sessionId = useState(() => uuid())[0];
  const role = readStoredRole();
  const canApprove = role === 'admin' || role === 'approver';
  const canPublish = role === 'admin';

  useEffect(() => {
    // Tenant-defined custom stages (enterprise-plan only) -- a 403/404 here just
    // means the tenant isn't entitled or has none configured, not an error worth
    // surfacing to every user on every product page.
    workflowStages.list().then(setCustomStages).catch(() => setCustomStages([]));
  }, []);

  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => products.brief(id).then((b) => !cancelled && setBrief(b)).catch(() => {});
    load();
    const intervalId = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [id]);

  const { polling: ingestPolling, startPolling: startIngestPolling } = useIngestPolling({
    productId: id,
    onComplete: () => {
      setResult({ status: 'completed', message: 'Ingest complete.' });
      showToast('success', 'Ingest complete.');
      products.artifacts(id).then(setArtifacts).catch(() => {});
    },
    onError: (message) => {
      setResult({ error: message });
      showToast('error', message);
    },
  });

  // Shared across query/build-profile/strategy/content -- only one of these
  // can be in flight at a time (all gated by the same loading/loadingAction
  // state below), so one polling instance is enough. Kept separate from the
  // async-proposal instance below since that flow is deliberately
  // non-blocking (doesn't set `loading`).
  const { startPolling: startWorkflowPolling } = useWorkflowPolling({
    onComplete: (run) => {
      setResult(run.output_data);
      setLoading(false);
      setLoadingAction(null);
      setTaskDetail(undefined);
      products.artifacts(id).then(setArtifacts).catch(() => {});
    },
    onError: (message) => {
      setResult({ error: message });
      setLoading(false);
      setLoadingAction(null);
      setTaskDetail(undefined);
      showToast('error', message);
    },
  });

  // Separate instance for the "Generate in background" proposal button --
  // deliberately non-blocking (doesn't touch loading/loadingAction) so the
  // user can keep using other tabs while it runs.
  const { run: asyncProposalRun, startPolling: startProposalPolling } = useWorkflowPolling({
    onComplete: () => {
      setGeneratingProposalAsync(false);
      showToast('success', 'Proposal generated in background.');
      products.artifacts(id).then(setArtifacts).catch(() => {});
    },
    onError: (message) => {
      setGeneratingProposalAsync(false);
      showToast('error', message || 'Background proposal generation failed');
    },
  });

  // The stage the current tab is actively driving -- overrides that stage's
  // derived need/idle status to "run" so the chain reflects in-page activity,
  // not just the last-fetched readiness snapshot.
  const runningStageId: ChainStageId | null =
    ingestPolling ? 'ingest'
    : loadingAction === 'understand' ? 'profile'
    : loadingAction === 'strategy' ? 'strategy'
    : loadingAction === 'outreach' ? 'outreach'
    : (loadingAction === 'proposal' || generatingProposalAsync) ? 'proposal'
    : null;
  const chainStages = deriveChain(brief?.gtm_readiness, runningStageId);
  const nextStage = nextActionableStage(chainStages);

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')));
  }, [searchParams]);

  useEffect(() => {
    if (!id) return;
    products.artifacts(id).then(setArtifacts).catch(() => {});
  }, [id, result]);

  function selectTab(next: Tab) {
    setTab(next);
    setResult(null);
    router.replace(`/products/${id}?tab=${next}`, { scroll: false });
  }

  const runAction = useCallback(async (action: AgentTaskId, params?: Record<string, unknown>) => {
    setLoading(true);
    setLoadingAction(action);
    setResult(null);
    if (action === 'outreach' && params?.company_url) {
      setTaskDetail(String(params.company_url));
    } else if ((action === 'architect' || action === 'query') && params?.question) {
      setTaskDetail(String(params.question));
    } else if (action === 'proposal' && params?.scope) {
      setTaskDetail(String(params.scope));
    } else if (action === 'content' && params?.topic) {
      setTaskDetail(String(params.topic));
    } else {
      setTaskDetail(undefined);
    }

    // These three run as async jobs (avoids the ~100s Cloudflare edge timeout
    // on slow LLM calls) -- kick off and return; the shared useWorkflowPolling
    // instance's onComplete/onError clears loading/result once the job finishes.
    if (action === 'understand' || action === 'strategy' || action === 'content' || action === 'query') {
      try {
        const accepted = action === 'understand'
          ? await products.startBuildProfile(id)
          : action === 'strategy'
            ? await products.startStrategy(id)
            : action === 'content'
              ? await products.startContent(id, params as { content_type: string; topic: string })
              : await products.startQuery(id, params as { question: string });
        startWorkflowPolling(accepted.workflow_run_id);
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Failed' });
        setLoading(false);
        setLoadingAction(null);
        setTaskDetail(undefined);
      }
      return;
    }

    try {
      let res: Record<string, unknown>;
      switch (action) {
        case 'ingest': {
          const ingestRes = await products.ingest(id, { async_mode: true });
          if (ingestRes.status === 'queued') startIngestPolling();
          res = { ...ingestRes };
          break;
        }
        case 'outreach': res = await products.outreach(id, params as { company_url: string; target_persona?: string; recipient_email?: string }); break;
        case 'architect': res = await products.architect(id, params?.question as string); break;
        case 'proposal': res = await products.proposal(id, params?.scope as string); break;
        case 'analytics': res = await products.analytics(id); break;
        default: return;
      }
      setResult(res);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setLoading(false);
      setLoadingAction(null);
      setTaskDetail(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleRefreshKnowledge() {
    setRefreshingKnowledge(true);
    try {
      const res = await products.refresh(id);
      if (res.status === 'queued') {
        startIngestPolling();
        showToast('success', 'Knowledge refresh queued.');
      } else {
        showToast('success', 'Knowledge refreshed.');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshingKnowledge(false);
    }
  }

  async function handleGenerateProposalAsync() {
    if (!proposalScope.trim()) return;
    setGeneratingProposalAsync(true);
    try {
      const accepted = await products.startGenerateProposal(id, { scope: proposalScope });
      startProposalPolling(accepted.workflow_run_id);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to start background proposal');
      setGeneratingProposalAsync(false);
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setLoadingAction('query');
    setTaskDetail(query);
    setResult(null);
    try {
      const accepted = await products.startQuery(id, { question: query });
      startWorkflowPolling(accepted.workflow_run_id);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed' });
      setLoading(false);
      setLoadingAction(null);
      setTaskDetail(undefined);
    }
  }

  async function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await products.chat(id, msg, sessionId);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Failed'}` }]);
    } finally {
      setLoading(false);
    }
  }

  if (productLoading || !product) {
    return (
      <div className="space-y-6">
        <SkeletonHero />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Full Forge"
        title={product.name}
        description={product.website_url ?? 'All agent tools in one workspace'}
        icon={WORKSPACE_ICONS.forge}
        accent={WORKSPACE_COLORS.forge}
        actions={
          <Badge variant={nextStage === null ? 'success' : nextStage.status === 'run' ? 'default' : 'warning'}>
            {chainStatusLabel(chainStages)}
          </Badge>
        }
      />

      <div className="space-y-6">
          {tab === 'overview' && (
            <div className="space-y-6">
              <OnboardingChecklist hasProduct firstProductId={id} />
              <TextMuted className="max-w-[64ch]">
                Everything below runs off one knowledge base — the chain shows where {product.name} stands
                and what it&apos;s waiting on. Nothing here needs a decision from you until it&apos;s ready.
              </TextMuted>
              <StageChain stages={chainStages} activeId={runningStageId ?? undefined} onSelect={(stageId) => router.push(chainStageHref(id, stageId))} />
              <NextAction
                stage={nextStage}
                loading={loading || ingestPolling}
                onAct={() => {
                  if (!nextStage) return;
                  if (nextStage.id === 'sources') {
                    document.getElementById('sources-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                  }
                  if (nextStage.id === 'ingest') {
                    runAction('ingest');
                    return;
                  }
                  if (nextStage.id === 'profile') {
                    runAction('understand');
                    return;
                  }
                  if (nextStage.id === 'strategy') {
                    // No required inputs (unlike outreach/proposal, which need a form
                    // filled in first) -- safe to trigger directly like ingest/profile.
                    runAction('strategy');
                    selectTab('strategy');
                    return;
                  }
                  router.push(chainStageHref(id, nextStage.id));
                }}
                onAlt={
                  nextStage?.id === 'sources'
                    ? () => {
                        setSourceOpenKind('github');
                        document.getElementById('sources-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    : nextStage?.id === 'ingest'
                      ? () => document.getElementById('sources-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      : nextStage?.id === 'profile'
                        ? handleRefreshKnowledge
                        : undefined
                }
              />
              <div id="sources-panel">
                <SourcesPanel
                  productId={id}
                  externalOpenKind={sourceOpenKind}
                  onExternalOpenHandled={() => setSourceOpenKind(undefined)}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button disabled={loading || ingestPolling} onClick={() => runAction('ingest')}>
                  {ingestPolling ? 'Ingesting…' : taskButtonLabel(loadingAction, loading, 'Crawl & Ingest', 'ingest')}
                </Button>
                <Button variant="secondary" disabled={loading} onClick={() => runAction('understand')}>
                  {taskButtonLabel(loadingAction, loading, 'Build Product Profile', 'understand')}
                </Button>
                <Button variant="secondary" disabled={loading || refreshingKnowledge || ingestPolling} onClick={handleRefreshKnowledge}>
                  {refreshingKnowledge ? 'Refreshing…' : 'Refresh Knowledge'}
                </Button>
              </div>
              {product.profile && Object.keys(product.profile).length > 0 && (
                <Card elevated>
                  <CardBody>
                    <SectionHeader title="Product Profile" />
                    <ProductProfileView profile={product.profile} />
                  </CardBody>
                </Card>
              )}
              {artifacts.length > 0 && (
                <section>
                  <SectionHeader
                    title="Recent Artifacts"
                    action={
                      <button
                        type="button"
                        onClick={() => selectTab('publish')}
                        className="text-body-sm text-primary hover:underline"
                      >
                        View all →
                      </button>
                    }
                  />
                  <div className="space-y-2">
                    {artifacts.slice(0, 5).map((a) => (
                      <Card key={a.id}>
                        <CardBody className="py-3 flex justify-between text-body-sm">
                          <Text>{a.title}</Text>
                          <TextSmall>{a.type} · {a.status}</TextSmall>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
              {chainStages.some((s) => s.status === 'idle') && (
                <section>
                  <SectionHeader
                    label="Waiting on knowledge"
                    title="Locked until ingest finishes"
                    description="These unlock automatically once ingest finishes."
                  />
                  <Card>
                    <CardBody>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                        {chainStages
                          .filter((s) => s.status !== 'idle' || s.id === 'sources' || s.id === 'ingest')
                          .map((s, i) => (
                            <span key={s.id} className="flex items-center gap-1.5">
                              {i > 0 && <span className="text-muted">→</span>}
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-[5px] border',
                                  s.status === 'done'
                                    ? 'border-success/30 bg-success/10 text-success'
                                    : s.status === 'need' || s.status === 'run'
                                      ? 'border-warning/30 bg-warning/10 text-warning'
                                      : 'border-border bg-background text-muted',
                                )}
                              >
                                {s.label.toLowerCase()}
                              </span>
                            </span>
                          ))}
                        {chainStages
                          .filter((s) => s.status === 'idle')
                          .map((s) => (
                            <span key={s.id} className="flex items-center gap-1.5">
                              <span className="text-muted">·</span>
                              <span className="px-2 py-0.5 rounded-[5px] border border-border bg-background text-muted">
                                {s.label.toLowerCase()}
                              </span>
                            </span>
                          ))}
                      </div>
                      <TextMuted className="mt-3 max-w-[64ch]">
                        {chainStages.filter((s) => s.status === 'idle').length} stages are dark because they
                        read from the knowledge base. None of them need a decision from you — they start
                        themselves in order.
                      </TextMuted>
                    </CardBody>
                  </Card>
                </section>
              )}
            </div>
          )}

          {tab === 'query' && (
            <form onSubmit={handleQuery} className="flex gap-3">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask anything…" className="flex-1" disabled={loading} />
              <Button type="submit" disabled={loading}>{taskButtonLabel(loadingAction, loading, 'Ask', 'query')}</Button>
            </form>
          )}

          {tab === 'strategy' && (
            <Button disabled={loading} onClick={() => runAction('strategy')}>
              {taskButtonLabel(loadingAction, loading, 'Generate GTM Strategy', 'strategy')}
            </Button>
          )}

          {tab === 'content' && (
            <div className="flex flex-wrap gap-3">
              <Button disabled={loading} onClick={() => runAction('content', { content_type: 'linkedin', topic: `${product.name} launch` })}>
                LinkedIn Post
              </Button>
              <Button variant="secondary" disabled={loading} onClick={() => runAction('content', { content_type: 'blog', topic: `${product.name} overview` })}>
                Blog Article
              </Button>
            </div>
          )}

          {tab === 'chat' && (
            <div>
              <Card elevated className="h-96 overflow-y-auto mb-4">
                <CardBody className="space-y-3">
                  {chatMessages.length === 0 && (
                    <TextMuted className="text-center py-10">Start a conversation with the sales agent</TextMuted>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={cn(
                        'max-w-[80%] px-4 py-2 rounded-lg text-body',
                        m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-surface border border-border',
                      )}>
                        {m.role === 'user' ? m.content : <Markdown className="text-body">{m.content}</Markdown>}
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
              <form onSubmit={handleChat} className="flex gap-3">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask about the product…" className="flex-1" />
                <Button type="submit" disabled={loading}>Send</Button>
              </form>
            </div>
          )}

          {tab === 'outreach' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!outreachUrl.trim()) return;
              runAction('outreach', {
                company_url: outreachUrl,
                target_persona: 'CTO',
                recipient_email: outreachRecipient || undefined,
              });
            }} className="flex flex-col gap-3 sm:flex-row">
              <Input
                name="company_url"
                type="url"
                value={outreachUrl}
                onChange={(e) => setOutreachUrl(e.target.value)}
                placeholder="https://prospect-company.com"
                required
                disabled={loading}
                className="flex-1"
              />
              <Input
                name="recipient_email"
                type="email"
                value={outreachRecipient}
                onChange={(e) => setOutreachRecipient(e.target.value)}
                placeholder="Recipient email (optional)"
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading}>
                {taskButtonLabel(loadingAction, loading, 'Generate Outreach', 'outreach')}
              </Button>
            </form>
          )}

          {tab === 'architect' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!architectQuestion.trim()) return;
              runAction('architect', { question: architectQuestion });
            }} className="flex gap-3">
              <Input value={architectQuestion} onChange={(e) => setArchitectQuestion(e.target.value)} placeholder="K8s HA deployment question…" className="flex-1" disabled={loading} />
              <Button type="submit" disabled={loading}>{taskButtonLabel(loadingAction, loading, 'Ask Architect', 'architect')}</Button>
            </form>
          )}

          {tab === 'proposal' && (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!proposalScope.trim()) return;
              runAction('proposal', { scope: proposalScope });
            }} className="flex gap-3">
              <Input value={proposalScope} onChange={(e) => setProposalScope(e.target.value)} placeholder="Enterprise scope…" className="flex-1" disabled={loading} />
              <Button type="submit" disabled={loading}>{taskButtonLabel(loadingAction, loading, 'Generate Proposal', 'proposal')}</Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading || generatingProposalAsync || !proposalScope.trim()}
                onClick={handleGenerateProposalAsync}
              >
                {generatingProposalAsync ? 'Generating…' : 'Generate in background'}
              </Button>
            </form>
          )}

          {tab === 'proposal' && asyncProposalRun && (
            <ProgressBar percent={workflowProgressPercent(asyncProposalRun)} label={`Background proposal: ${asyncProposalRun.status}`} />
          )}

          {tab === 'proposal' && typeof result?.artifact_id === 'string' && (
            <div className="flex flex-wrap gap-2">
              {(['pdf', 'docx', 'pptx'] as const).map((format) => (
                <Button
                  key={format}
                  size="sm"
                  variant="secondary"
                  onClick={() => products.downloadProposalExport(id, result.artifact_id as string, format)}
                >
                  Export {format.toUpperCase()}
                </Button>
              ))}
            </div>
          )}

          {tab === 'publish' && (
            <ArtifactList
              artifacts={artifacts}
              canApprove={canApprove}
              canPublish={canPublish}
              onChanged={() => products.artifacts(id).then(setArtifacts).catch(() => {})}
            />
          )}

          {tab === 'analytics' && (
            <Button disabled={loading} onClick={() => runAction('analytics')}>
              {taskButtonLabel(loadingAction, loading, 'Load Analytics', 'analytics')}
            </Button>
          )}

          {tab.startsWith('custom:') && (() => {
            const stage = customStages.find((s) => `custom:${s.id}` === tab);
            if (!stage) return null;
            return (
              <StageBlockRenderer
                blocks={stage.content_blocks}
                running={loading}
                onRunAction={(action, params) => runAction(action as AgentTaskId, params)}
              />
            );
          })()}

          {loading && loadingAction && (
            <AgentTaskProgress task={loadingAction} detail={taskDetail} />
          )}

          {result && !loading && (
            <Card elevated>
              <CardBody>
                <ResultPanel result={result} />
              </CardBody>
            </Card>
          )}
      </div>

      <ChatWidget productId={id} />
    </div>
  );
}
