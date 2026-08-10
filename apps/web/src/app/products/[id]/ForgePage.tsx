'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { products, type Artifact, type WorkflowRunStatus } from '@/lib/api';
import { useIngestPolling } from '@/lib/useIngestPolling';
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
import ArtifactList from '@/components/artifacts/ArtifactList';
import AgentTaskProgress from '@/components/AgentTaskProgress';
import { taskButtonLabel, type AgentTaskId } from '@/lib/agent-tasks';
import { cn } from '@/lib/cn';
import { Eyebrow, Text, TextMuted, TextSmall } from '@/components/ui/Typography';

type Tab = 'overview' | 'query' | 'strategy' | 'content' | 'chat' | 'outreach' | 'architect' | 'proposal' | 'publish' | 'analytics';

const TAB_GROUPS: { label: string; tabs: { key: Tab; label: string }[] }[] = [
  { label: 'Foundation', tabs: [{ key: 'overview', label: 'Overview' }, { key: 'query', label: 'Q&A' }] },
  { label: 'GTM', tabs: [{ key: 'strategy', label: 'Strategy' }, { key: 'content', label: 'Content' }] },
  {
    label: 'Revenue',
    tabs: [
      { key: 'chat', label: 'Sales Chat' },
      { key: 'outreach', label: 'Outreach' },
      { key: 'architect', label: 'Architect' },
      { key: 'proposal', label: 'Proposal' },
    ],
  },
  { label: 'Distribution', tabs: [{ key: 'publish', label: 'Publish' }] },
  { label: 'Intelligence', tabs: [{ key: 'analytics', label: 'Analytics' }] },
];

const VALID_TABS = new Set(TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.key)));

function parseTab(value: string | null): Tab {
  if (value && VALID_TABS.has(value as Tab)) return value as Tab;
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
  const [asyncProposalRun, setAsyncProposalRun] = useState<WorkflowRunStatus | null>(null);
  const [generatingProposalAsync, setGeneratingProposalAsync] = useState(false);
  const sessionId = useState(() => uuid())[0];
  const role = readStoredRole();
  const canApprove = role === 'admin' || role === 'approver';
  const canPublish = role === 'admin';

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
    } else if (action === 'architect' && params?.question) {
      setTaskDetail(String(params.question));
    } else if (action === 'proposal' && params?.scope) {
      setTaskDetail(String(params.scope));
    } else if (action === 'content' && params?.topic) {
      setTaskDetail(String(params.topic));
    } else {
      setTaskDetail(undefined);
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
        case 'understand': res = await products.understand(id); break;
        case 'strategy': res = await products.strategy(id); break;
        case 'content': res = await products.content(id, params as { content_type: string; topic: string }); break;
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
    setAsyncProposalRun(null);
    try {
      const accepted = await products.startGenerateProposal(id, { scope: proposalScope });
      const poll = async () => {
        const run = await products.pollWorkflow(accepted.workflow_run_id);
        setAsyncProposalRun(run);
        if (run.status === 'queued' || run.status === 'running') {
          setTimeout(poll, 3000);
          return;
        }
        setGeneratingProposalAsync(false);
        if (run.status === 'completed') {
          showToast('success', 'Proposal generated in background.');
          products.artifacts(id).then(setArtifacts).catch(() => {});
        } else {
          showToast('error', run.error_message || 'Background proposal generation failed');
        }
      };
      setTimeout(poll, 2000);
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
      setResult(await products.query(id, query));
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed' });
    } finally {
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
    return <div className="text-muted">Loading forge…</div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Full Forge"
        title={product.name}
        description={product.website_url ?? 'All agent tools in one workspace'}
        actions={
          <Badge variant={product.profile_status === 'ready' ? 'success' : 'warning'}>
            {product.profile_status}
          </Badge>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-52 shrink-0 space-y-4" aria-label="Forge topics">
          {TAB_GROUPS.map((group) => (
            <div key={group.label}>
              <Eyebrow className="text-primary mb-2 px-2">{group.label}</Eyebrow>
              <ul className="space-y-0.5">
                {group.tabs.map((t) => (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => selectTab(t.key)}
                      aria-current={tab === t.key ? 'page' : undefined}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-body-sm transition-colors focus-ring',
                        tab === t.key
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted hover:text-foreground hover:bg-surface',
                      )}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-6">
          {tab === 'overview' && (
            <div className="space-y-6">
              <SourcesPanel productId={id} />
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
      </div>

      <ChatWidget productId={id} />
    </div>
  );
}
