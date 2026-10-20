'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import {
  products,
  type DealProof,
  type DealRequirement,
  type DealWorkspace,
  type ProofVerdict,
} from '@/lib/api';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { KpiStrip, WorkspacePage, WorkspacePanel } from '@/components/layout/WorkspacePanel';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Textarea } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table';
import { TextMuted, TextSmall } from '@/components/ui/Typography';

const VERDICTS: Record<ProofVerdict, { label: string; variant: BadgeVariant }> = {
  supported: { label: 'Supported', variant: 'success' },
  partial: { label: 'With conditions', variant: 'warning' },
  roadmap: { label: 'Roadmap', variant: 'purple' },
  gap: { label: 'Gap', variant: 'danger' },
  unknown: { label: 'Unknown', variant: 'default' },
};

export default function DealWorkspacePage() {
  const { id, oppId } = useParams<{ id: string; oppId: string }>();
  const [ws, setWs] = useState<DealWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    products
      .dealWorkspace(id, oppId)
      .then(setWs)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load deal'))
      .finally(() => setLoading(false));
  }, [id, oppId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run<T>(key: string, action: () => Promise<T>, onDone: (r: T) => void, fallback: string) {
    setBusy(key);
    try {
      onDone(await action());
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(null);
    }
  }

  const addRequirements = () =>
    run('add', () => products.addRequirements(id, oppId, text), (rows) => {
      showToast('success', `Added ${rows.length} requirement${rows.length === 1 ? '' : 's'}.`);
      setText('');
      load();
    }, 'Could not add requirements');

  const analyze = (ids?: string[]) =>
    run('analyze', () => products.analyzeRequirements(id, oppId, ids), (next) => {
      setWs(next);
      showToast('success', 'Evidence updated.');
    }, 'Analysis failed');

  const review = (req: DealRequirement, status: 'approved' | 'rejected') =>
    run(`review-${req.id}`, () => products.reviewProof(id, oppId, req.id, { status }), () => load(), 'Review failed');

  const draftResponse = () =>
    run('draft', () => products.draftRequirementResponse(id, oppId), (r) => {
      const skipped = r.skipped_unapproved + r.skipped_stale;
      showToast(
        'success',
        `Draft response created with ${r.included} approved item${r.included === 1 ? '' : 's'}` +
          (skipped ? ` (${skipped} left out: not approved or out of date). Review it under Content approvals.` : '. Review it under Content approvals.'),
      );
    }, 'Could not draft the response');

  const s = ws?.summary ?? {};

  return (
    <WorkspacePage>
      <PageHero
        eyebrow="Deal workspace"
        title={ws?.opportunity.name ?? 'Deal workspace'}
        description="Map the customer's requirements to documented capabilities, review the evidence, and send only what has been approved."
        actions={
          <>
            <Link href={`/products/${id}/pipeline`} className="self-center text-[14px] text-[var(--accent-blue)] hover:underline">
              ← Pipeline
            </Link>
            <Button variant="secondary" disabled={!!busy || !ws?.requirements.length} onClick={() => analyze()}>
              {busy === 'analyze' ? 'Analyzing…' : 'Analyze new requirements'}
            </Button>
            <Button disabled={!!busy || !s.approved} onClick={draftResponse}>
              {busy === 'draft' ? 'Drafting…' : 'Draft customer response'}
            </Button>
          </>
        }
      />

      {ws ? (
        <KpiStrip
          items={[
            { label: 'Requirements', value: s.total ?? 0 },
            { label: 'Supported', value: (s.supported ?? 0) + (s.partial ?? 0) },
            { label: 'Roadmap / gaps', value: (s.roadmap ?? 0) + (s.gap ?? 0) },
            { label: 'Unknown', value: (s.unknown ?? 0) + (s.unanalyzed ?? 0) },
            { label: 'Approved', value: `${s.approved ?? 0}/${s.total ?? 0}` },
          ]}
        />
      ) : null}

      {ws && ws.next_actions.length > 0 ? (
        <Callout tone="info" title="Next actions">
          <ul className="m-0 list-disc pl-5">
            {ws.next_actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <WorkspacePanel
        title="Add requirements"
        description="Paste an RFP section, a questionnaire, or an email. Compound questions are split into separate requirements."
        bodyClassName="p-4 space-y-3"
      >
        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Can your platform support Windows workloads, disconnected deployment and our storage backend?"
        />
        <Button disabled={!!busy || !text.trim()} onClick={addRequirements}>
          {busy === 'add' ? 'Adding…' : 'Add requirements'}
        </Button>
      </WorkspacePanel>

      <WorkspacePanel title="Requirement-to-proof matrix" bodyClassName="p-4">
        {loading ? (
          <TextMuted>Loading…</TextMuted>
        ) : !ws || ws.requirements.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No requirements yet"
            description="Add the customer's requirements above, then analyze them against your documentation."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Requirement</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Evidence and conditions</TableHeaderCell>
                <TableHeaderCell>Review</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ws.requirements.map((r) => (
                <MatrixRow
                  key={r.id}
                  req={r}
                  expanded={open === r.id}
                  onToggle={() => setOpen(open === r.id ? null : r.id)}
                  busy={busy === `review-${r.id}`}
                  onReview={(status) => review(r, status)}
                  onReanalyze={() => analyze([r.id])}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </WorkspacePanel>
    </WorkspacePage>
  );
}

function MatrixRow({
  req,
  expanded,
  onToggle,
  busy,
  onReview,
  onReanalyze,
}: {
  req: DealRequirement;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  onReview: (status: 'approved' | 'rejected') => void;
  onReanalyze: () => void;
}) {
  const proof = req.proof;
  const verdict = proof ? VERDICTS[proof.verdict] : null;
  return (
    <TableRow>
      <TableCell className="align-top max-w-[22rem]">{req.text}</TableCell>
      <TableCell className="align-top whitespace-nowrap">
        {verdict ? <Badge variant={verdict.variant}>{verdict.label}</Badge> : <Badge>Not analyzed</Badge>}
        {proof?.stale_reason ? (
          <div className="mt-1"><Badge variant="warning">Source changed</Badge></div>
        ) : null}
      </TableCell>
      <TableCell className="align-top max-w-[32rem]">
        {proof ? <ProofDetail proof={proof} expanded={expanded} onToggle={onToggle} /> : <TextMuted>—</TextMuted>}
      </TableCell>
      <TableCell className="align-top whitespace-nowrap">
        {!proof ? null : proof.stale_reason ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onReanalyze}>Re-analyze</Button>
        ) : proof.review_status === 'pending' ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => onReview('approved')}>Approve</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onReview('rejected')}>Reject</Button>
          </div>
        ) : (
          <div className="space-y-1">
            <Badge variant={proof.review_status === 'approved' ? 'success' : 'danger'}>{proof.review_status}</Badge>
            <div>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onReanalyze}>Re-analyze</Button>
            </div>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function ProofDetail({ proof, expanded, onToggle }: { proof: DealProof; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-2">
      <p className="m-0">{proof.answer}</p>
      {proof.conditions ? (
        <TextSmall><span className="text-muted">Conditions: </span>{proof.conditions}</TextSmall>
      ) : null}
      {proof.validation_test ? (
        <TextSmall><span className="text-muted">Validate by: </span>{proof.validation_test}</TextSmall>
      ) : null}
      {proof.citations.length > 0 ? (
        <div>
          <button type="button" onClick={onToggle} className="text-[13px] text-[var(--accent-blue)] hover:underline">
            {expanded ? 'Hide' : 'Show'} evidence ({proof.citations.length})
          </button>
          {expanded ? (
            <ul className="m-0 mt-2 list-none space-y-2 p-0">
              {proof.citations.map((c) => (
                <li key={c.chunk_id} className="rounded-[var(--radius-sm)] border border-border p-2">
                  <TextSmall className="font-medium">
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-[var(--accent-blue)] hover:underline">
                        {c.document_title || c.url}
                      </a>
                    ) : (
                      c.document_title
                    )}
                  </TextSmall>
                  <TextSmall className="text-muted">{c.excerpt}</TextSmall>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <TextSmall className="text-muted">No supporting documentation cited.</TextSmall>
      )}
    </div>
  );
}
