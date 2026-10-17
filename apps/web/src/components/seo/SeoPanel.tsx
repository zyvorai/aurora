'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { seo, type Artifact, type SeoAuditResult, type SeoKeywordResult, type SeoProviders, type SeoScoreResult } from '@/lib/api';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { StatBand, type StatBandItem } from '@/components/ui/StatBand';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { SerpPreview } from '@/components/seo/SerpPreview';
import { FileText, Search } from 'lucide-react';

type View = 'audit' | 'keywords' | 'content';
const VIEWS: { key: View; label: string }[] = [
  { key: 'audit', label: 'Page audit' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'content', label: 'Content score' },
];

const SEVERITY: Record<string, BadgeVariant> = { critical: 'danger', warning: 'warning', info: 'default' };

function scoreTone(score: number): StatBandItem['tone'] {
  return score >= 80 ? 'success' : score < 50 ? 'danger' : 'warning';
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export default function SeoPanel({ productId, websiteUrl, artifacts }: { productId: string; websiteUrl?: string | null; artifacts: Artifact[] }) {
  const [view, setView] = useState<View>('audit');
  const [providers, setProviders] = useState<SeoProviders | null>(null);

  useEffect(() => {
    seo.providers().then(setProviders).catch(() => setProviders(null));
  }, []);

  return (
    <div className="space-y-5 p-4">
      <Tabs items={VIEWS} value={view} onChange={setView} label="SEO tools" />
      {view === 'audit' && <AuditView productId={productId} initialUrl={websiteUrl ?? ''} />}
      {view === 'keywords' && <KeywordsView productId={productId} providers={providers} />}
      {view === 'content' && <ContentView artifacts={artifacts} wordpress={providers?.publish.wordpress ?? false} />}
    </div>
  );
}

function AuditView({ productId, initialUrl }: { productId: string; initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeoAuditResult | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await seo.audit(productId, url.trim()));
    } catch (e) {
      setError(errMsg(e, 'Audit failed'));
    } finally {
      setBusy(false);
    }
  }, [productId, url]);

  const stats: StatBandItem[] = result
    ? [
        { label: 'SEO score', value: result.score, tone: scoreTone(result.score) },
        { label: 'Words', value: result.word_count },
        { label: 'Findings', value: result.findings.length },
        { label: 'Images missing alt', value: result.images_missing_alt, tone: result.images_missing_alt ? 'warning' : undefined },
      ]
    : [];

  return (
    <section className="space-y-4" aria-label="Page audit">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) void run();
        }}
      >
        <div className="flex-1">
          <label htmlFor="seo-url" className="mb-1.5 block text-[length:var(--fs-small)] text-muted">Public page URL</label>
          <Input id="seo-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/pricing" inputMode="url" />
        </div>
        <Button type="submit" disabled={busy || !url.trim()}>{busy ? 'Auditing…' : 'Audit page'}</Button>
      </form>

      {busy && <SkeletonTable />}
      {error && !busy && <ErrorState title="Couldn't audit that page" message={error} onRetry={run} />}
      {!result && !busy && !error && (
        <EmptyState icon={Search} title="Audit a page" description="Checks title, description, headings, canonical, structured data, images and links. Nothing here is estimated: every finding comes from the page itself." />
      )}
      {result && !busy && (
        <>
          <StatBand items={stats} />
          <SerpPreview title={result.title} description={result.meta_description} url={result.canonical || result.url} />
          {result.findings.length === 0 ? (
            <Callout tone="success" title="No issues found">This page passes every check.</Callout>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Severity</TableHeaderCell>
                  <TableHeaderCell>Finding</TableHeaderCell>
                  <TableHeaderCell>How to fix</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {result.findings.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell><Badge variant={SEVERITY[f.severity] ?? 'default'}>{f.severity}</Badge></TableCell>
                    <TableCell>{f.message}</TableCell>
                    <TableCell className="text-muted">{f.fix}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </section>
  );
}

function KeywordsView({ productId, providers }: { productId: string; providers: SeoProviders | null }) {
  const [seed, setSeed] = useState('');
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeoKeywordResult | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await seo.keywords(productId, { seed, provider: provider || undefined }));
    } catch (e) {
      setError(errMsg(e, 'Keyword research failed'));
    } finally {
      setBusy(false);
    }
  }, [productId, seed, provider]);

  const measured = result?.measured ?? false;
  const configured = useMemo(
    () => Object.entries(providers?.providers ?? {}).filter(([, v]) => v.configured).map(([k]) => k),
    [providers],
  );

  return (
    <section className="space-y-4" aria-label="Keyword research">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="flex-1">
          <label htmlFor="seo-seed" className="mb-1.5 block text-[length:var(--fs-small)] text-muted">Topic or seed keyword</label>
          <Input id="seo-seed" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Leave empty to use the product name" />
        </div>
        <Select label="Data source" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="">Default ({providers?.default ?? 'grounded'})</option>
          {configured.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Button type="submit" disabled={busy}>{busy ? 'Researching…' : 'Find keywords'}</Button>
      </form>

      {busy && <SkeletonTable />}
      {error && !busy && <ErrorState title="Couldn't research keywords" message={error} onRetry={run} />}
      {!result && !busy && !error && (
        <EmptyState icon={Search} title="Find keywords worth writing for" description="Without a keyword provider Aurora mines terms from your own knowledge base and labels them as estimates. Connect DataForSEO or Search Console for measured data." />
      )}
      {result && !busy && (
        <>
          {!measured && (
            <Callout tone="warning" title="Estimates, not search data">
              These terms come from your product knowledge base. They show what you already say, not how often people search for it.
            </Callout>
          )}
          {result.keywords.length === 0 ? (
            <EmptyState title="No keywords found" description="Ingest more sources or try a broader seed." />
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Keyword</TableHeaderCell>
                  <TableHeaderCell>Intent</TableHeaderCell>
                  <TableHeaderCell>Source</TableHeaderCell>
                  <TableHeaderCell className="text-right">{result.provider === 'search_console' ? 'Clicks' : 'Volume'}</TableHeaderCell>
                  <TableHeaderCell className="text-right">{result.provider === 'search_console' ? 'Position' : 'Difficulty'}</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {result.keywords.map((k) => (
                  <TableRow key={k.keyword}>
                    <TableCell className="font-medium">{k.keyword}</TableCell>
                    <TableCell className="text-muted">{k.intent}</TableCell>
                    <TableCell><Badge variant={k.source === 'estimate' ? 'default' : 'blue'}>{k.source === 'estimate' ? 'estimate' : k.source}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{k.clicks ?? k.volume ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.position ?? k.difficulty ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </section>
  );
}

function ContentView({ artifacts, wordpress }: { artifacts: Artifact[]; wordpress: boolean }) {
  const drafts = useMemo(() => artifacts.filter((a) => a.type === 'content'), [artifacts]);
  const [artifactId, setArtifactId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeoScoreResult | null>(null);
  const selected = artifactId || drafts[0]?.id || '';

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await seo.score(selected, keyword.trim()));
    } catch (e) {
      setError(errMsg(e, 'Scoring failed'));
    } finally {
      setBusy(false);
    }
  }, [selected, keyword]);

  if (drafts.length === 0) {
    return <EmptyState icon={FileText} title="No content drafts yet" description='Generate an article on the Content tab (choose "seo_article" or "blog"), then score it here.' />;
  }

  return (
    <section className="space-y-4" aria-label="Content score">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (keyword.trim()) void run();
        }}
      >
        <Select label="Draft" value={selected} onChange={(e) => { setArtifactId(e.target.value); setResult(null); }} className="min-w-[14rem]">
          {drafts.map((d) => <option key={d.id} value={d.id}>{d.title || d.id.slice(0, 8)} · {d.status}</option>)}
        </Select>
        <div className="flex-1">
          <label htmlFor="seo-kw" className="mb-1.5 block text-[length:var(--fs-small)] text-muted">Target keyword</label>
          <Input id="seo-kw" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. storage control plane" />
        </div>
        <Button type="submit" disabled={busy || !keyword.trim()}>{busy ? 'Scoring…' : 'Score draft'}</Button>
      </form>

      {error && <ErrorState title="Couldn't score that draft" message={error} onRetry={run} />}
      {result && !error && (
        <>
          <StatBand
            items={[
              { label: 'SEO score', value: result.score, tone: scoreTone(result.score) },
              ...Object.entries(result.components).map(([k, v]) => ({ label: k, value: v })),
            ]}
          />
          <SerpPreview title={result.meta_title} description={result.meta_description} />
          {result.suggestions.length > 0 && (
            <Callout tone="info" title="To improve the score">
              <ul className="list-disc space-y-1 pl-4">
                {result.suggestions.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </Callout>
          )}
          <details className="rounded-[var(--radius-md)] border border-border bg-surface-elevated p-4">
            <summary className="focus-ring cursor-pointer text-[length:var(--fs-small)] text-foreground">Structured data (JSON-LD)</summary>
            <pre className="mt-3 overflow-x-auto text-[length:var(--fs-micro)] text-muted">{JSON.stringify(result.schema_jsonld, null, 2)}</pre>
          </details>
          <Callout tone="info">
            Scoring saves the meta text and JSON-LD with the draft. If the draft was already approved it goes back to draft so a reviewer approves the new meta too.
            {wordpress ? ' Publish to WordPress from the Publish tab.' : ' Set the WORDPRESS_* variables to enable the WordPress channel.'}
          </Callout>
        </>
      )}
    </section>
  );
}
