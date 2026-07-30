'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { products, type Product, type Artifact } from '@/lib/api';
import ChatWidget from '@/components/ChatWidget';

type Tab = 'overview' | 'query' | 'strategy' | 'content' | 'chat' | 'outreach' | 'architect' | 'proposal' | 'analytics';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [architectQuestion, setArchitectQuestion] = useState('');
  const [proposalScope, setProposalScope] = useState('');
  const sessionId = useState(() => crypto.randomUUID())[0];

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/'); return; }
    products.get(id).then(setProduct).catch(() => router.push('/dashboard'));
    products.artifacts(id).then(setArtifacts).catch(() => {});
  }, [id, router]);

  const runAction = useCallback(async (action: string, params?: Record<string, unknown>) => {
    setLoading(true);
    setResult(null);
    try {
      let res: Record<string, unknown>;
      switch (action) {
        case 'ingest': res = await products.ingest(id); break;
        case 'understand': res = await products.understand(id); break;
        case 'strategy': res = await products.strategy(id); break;
        case 'content': res = await products.content(id, params as { content_type: string; topic: string }); break;
        case 'outreach': res = await products.outreach(id, params as { company_url: string }); break;
        case 'architect': res = await products.architect(id, params?.question as string); break;
        case 'proposal': res = await products.proposal(id, params?.scope as string); break;
        case 'analytics': res = await products.analytics(id); break;
        default: return;
      }
      setResult(res);
      products.get(id).then(setProduct);
      products.artifacts(id).then(setArtifacts).catch(() => {});
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await products.query(id, query);
      setResult(res);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setLoading(false);
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
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + (err instanceof Error ? err.message : 'Failed') }]);
    } finally {
      setLoading(false);
    }
  }

  if (!product) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--text-secondary)]">Loading...</div>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'query', label: 'Q&A' },
    { key: 'strategy', label: 'Strategy' },
    { key: 'content', label: 'Content' },
    { key: 'chat', label: 'Sales Chat' },
    { key: 'outreach', label: 'Outreach' },
    { key: 'architect', label: 'Architect' },
    { key: 'proposal', label: 'Proposal' },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-gtm-border px-6 py-4">
        <Link href="/dashboard" className="text-[var(--text-secondary)] text-sm hover:text-white mb-2 inline-block">
          &larr; Back to Products
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            {product.website_url && <p className="text-[var(--text-secondary)] text-sm">{product.website_url}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            product.profile_status === 'ready' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
          }`}>{product.profile_status}</span>
        </div>
      </header>

      <nav className="border-b border-gtm-border px-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setResult(null); }}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key ? 'border-gtm-accent text-gtm-accent' : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}>{t.label}</button>
        ))}
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {tab === 'overview' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-wrap gap-3">
              <button onClick={() => runAction('ingest')} disabled={loading}
                className="px-4 py-2 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50">
                {loading ? 'Processing...' : 'Crawl & Ingest'}
              </button>
              <button onClick={() => runAction('understand')} disabled={loading}
                className="px-4 py-2 border border-gtm-border rounded-md hover:border-gtm-accent disabled:opacity-50">
                Build Product Profile
              </button>
            </div>
            {product.profile && (
              <div className="bg-gtm-card border border-gtm-border rounded-lg p-6">
                <h3 className="font-semibold mb-3">Product Profile</h3>
                <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-mono overflow-auto max-h-96">
                  {JSON.stringify(product.profile, null, 2)}
                </pre>
              </div>
            )}
            {artifacts.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Recent Artifacts</h3>
                <div className="space-y-2">
                  {artifacts.slice(0, 5).map((a) => (
                    <div key={a.id} className="bg-gtm-card border border-gtm-border rounded-md px-4 py-3 flex justify-between">
                      <span>{a.title}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{a.type} &middot; {a.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'query' && (
          <div className="animate-fade-up">
            <form onSubmit={handleQuery} className="flex gap-3 mb-6">
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about this product..."
                className="flex-1 px-4 py-3 bg-gtm-card border border-gtm-border rounded-md focus:outline-none focus:border-gtm-accent" />
              <button type="submit" disabled={loading}
                className="px-6 py-3 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50">Ask</button>
            </form>
          </div>
        )}

        {tab === 'strategy' && (
          <div className="animate-fade-up">
            <button onClick={() => runAction('strategy')} disabled={loading}
              className="px-6 py-3 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50 mb-6">
              Generate GTM Strategy
            </button>
          </div>
        )}

        {tab === 'content' && (
          <div className="animate-fade-up space-y-4">
            <button onClick={() => runAction('content', { content_type: 'linkedin', topic: product.name + ' product launch' })}
              disabled={loading}
              className="px-6 py-3 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50 mr-3">
              Generate LinkedIn Post
            </button>
            <button onClick={() => runAction('content', { content_type: 'blog', topic: product.name + ' technical overview' })}
              disabled={loading}
              className="px-6 py-3 border border-gtm-border rounded-md disabled:opacity-50">
              Generate Blog Article
            </button>
          </div>
        )}

        {tab === 'chat' && (
          <div className="animate-fade-up">
            <div className="bg-gtm-card border border-gtm-border rounded-lg h-96 overflow-y-auto p-4 mb-4 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-[var(--text-secondary)] text-center py-10">Start a conversation with the sales agent</p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                    m.role === 'user' ? 'bg-gtm-accent text-gtm-bg' : 'bg-gtm-bg border border-gtm-border'
                  }`}>{m.content}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleChat} className="flex gap-3">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about the product..."
                className="flex-1 px-4 py-3 bg-gtm-card border border-gtm-border rounded-md focus:outline-none focus:border-gtm-accent" />
              <button type="submit" disabled={loading}
                className="px-6 py-3 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50">Send</button>
            </form>
          </div>
        )}

        {tab === 'outreach' && (
          <div className="animate-fade-up">
            <form onSubmit={(e) => {
              e.preventDefault();
              const url = (e.target as HTMLFormElement).company_url.value;
              runAction('outreach', { company_url: url, target_persona: 'CTO' });
            }} className="flex gap-3 mb-6">
              <input name="company_url" type="url" placeholder="https://prospect-company.com" required
                className="flex-1 px-4 py-3 bg-gtm-card border border-gtm-border rounded-md focus:outline-none focus:border-gtm-accent" />
              <button type="submit" disabled={loading}
                className="px-6 py-3 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50">Generate Outreach</button>
            </form>
          </div>
        )}

        {tab === 'architect' && (
          <div className="animate-fade-up">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!architectQuestion.trim()) return;
              runAction('architect', { question: architectQuestion });
            }} className="flex gap-3 mb-6">
              <input value={architectQuestion} onChange={(e) => setArchitectQuestion(e.target.value)}
                placeholder="How would this product deploy on Kubernetes with HA?"
                className="flex-1 px-4 py-3 bg-gtm-card border border-gtm-border rounded-md focus:outline-none focus:border-gtm-accent" />
              <button type="submit" disabled={loading}
                className="px-6 py-3 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50">Ask Architect</button>
            </form>
          </div>
        )}

        {tab === 'proposal' && (
          <div className="animate-fade-up">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!proposalScope.trim()) return;
              runAction('proposal', { scope: proposalScope });
            }} className="flex gap-3 mb-6">
              <input value={proposalScope} onChange={(e) => setProposalScope(e.target.value)}
                placeholder="Enterprise deployment for 500 developers, 12-month engagement"
                className="flex-1 px-4 py-3 bg-gtm-card border border-gtm-border rounded-md focus:outline-none focus:border-gtm-accent" />
              <button type="submit" disabled={loading}
                className="px-6 py-3 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50">Generate Proposal</button>
            </form>
          </div>
        )}

        {tab === 'analytics' && (
          <div className="animate-fade-up">
            <button onClick={() => runAction('analytics')} disabled={loading}
              className="px-6 py-3 bg-gtm-accent text-gtm-bg font-medium rounded-md disabled:opacity-50 mb-6">
              Load Analytics
            </button>
          </div>
        )}

        {result && (
          <div className="mt-6 bg-gtm-card border border-gtm-border rounded-lg p-6 animate-fade-up">
            <h3 className="font-semibold mb-3">Result</h3>
            {'answer' in result && !('reply' in result) && <p className="mb-4 whitespace-pre-wrap">{result.answer as string}</p>}
            {'reply' in result && <p className="mb-4 whitespace-pre-wrap">{result.reply as string}</p>}
            {'content' in result && <p className="mb-4 whitespace-pre-wrap">{result.content as string}</p>}
            {'email_draft' in result && <p className="mb-4 whitespace-pre-wrap">{result.email_draft as string}</p>}
            {'proposal_content' in result && <p className="mb-4 whitespace-pre-wrap">{result.proposal_content as string}</p>}
            {'gtm_strategy' in result && <p className="mb-4 whitespace-pre-wrap">{result.gtm_strategy as string}</p>}
            <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono overflow-auto max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </main>
      <ChatWidget productId={id} apiUrl="/api" />
    </div>
  );
}
