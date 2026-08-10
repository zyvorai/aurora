'use client';

import { useEffect, useState } from 'react';
import { products, type Opportunity, type SuccessPlanResponse } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useWorkflowPolling } from '@/lib/useWorkflowPolling';
import { workflowProgressPercent } from '@/lib/workflow-progress';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TextMuted, TextSmall } from '@/components/ui/Typography';

interface OpportunityDetailModalProps {
  productId: string;
  opportunityId: string;
  onClose: () => void;
  onChanged?: () => void;
}

export default function OpportunityDetailModal({ productId, opportunityId, onClose, onChanged }: OpportunityDetailModalProps) {
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [successPlan, setSuccessPlan] = useState<SuccessPlanResponse | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const { run: proposalRun, startPolling: startProposalPolling } = useWorkflowPolling({
    onComplete: () => {
      setGeneratingProposal(false);
      showToast('success', 'Proposal generated.');
      load();
      onChanged?.();
    },
    onError: (message) => {
      setGeneratingProposal(false);
      showToast('error', message || 'Proposal generation failed');
    },
  });

  const load = () => {
    setLoading(true);
    products.getOpportunity(productId, opportunityId)
      .then(setOpp)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load opportunity'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [productId, opportunityId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateProposal() {
    setGeneratingProposal(true);
    try {
      const accepted = await products.startGenerateProposal(productId, {
        scope: opp?.name ? `Proposal for ${opp.name}` : 'Enterprise deployment',
        opportunity_id: opportunityId,
      });
      startProposalPolling(accepted.workflow_run_id);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to start proposal generation');
      setGeneratingProposal(false);
    }
  }

  async function generateSuccessPlan() {
    setGeneratingPlan(true);
    try {
      const plan = await products.createSuccessPlan(productId, opportunityId);
      setSuccessPlan(plan);
      showToast('success', 'Success plan generated.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to generate success plan');
    } finally {
      setGeneratingPlan(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={opp?.name ?? 'Opportunity'}>
      {loading ? (
        <TextMuted>Loading…</TextMuted>
      ) : !opp ? (
        <TextMuted>Not found.</TextMuted>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-body-sm">
            <div><TextSmall className="text-muted">Company</TextSmall><p>{opp.company ?? '—'}</p></div>
            <div><TextSmall className="text-muted">Stage</TextSmall><p><Badge>{opp.stage}</Badge></p></div>
            <div><TextSmall className="text-muted">Amount</TextSmall><p>{opp.amount ? `$${opp.amount.toLocaleString()}` : '—'}</p></div>
            <div><TextSmall className="text-muted">Probability</TextSmall><p>{Math.round(opp.probability * 100)}%</p></div>
          </div>

          <div>
            <TextSmall className="mb-2 block text-muted">Proposal</TextSmall>
            {opp.proposal_artifact_id ? (
              <div className="flex flex-wrap gap-2">
                {(['pdf', 'docx', 'pptx'] as const).map((format) => (
                  <Button
                    key={format}
                    size="sm"
                    variant="secondary"
                    onClick={() => products.downloadProposalExport(productId, opp.proposal_artifact_id as string, format)}
                  >
                    Export {format.toUpperCase()}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Button size="sm" disabled={generatingProposal} onClick={generateProposal}>
                  {generatingProposal ? 'Generating…' : 'Generate Proposal'}
                </Button>
                {proposalRun && (
                  <ProgressBar percent={workflowProgressPercent(proposalRun)} label={`Status: ${proposalRun.status}`} />
                )}
              </div>
            )}
          </div>

          {opp.architect_artifact_id && (
            <div>
              <TextSmall className="mb-1 block text-muted">Technical Architecture</TextSmall>
              <Badge variant="success">Ready</Badge>
            </div>
          )}

          <div>
            <TextSmall className="mb-2 block text-muted">Customer Success</TextSmall>
            <Button size="sm" variant="secondary" disabled={generatingPlan} onClick={generateSuccessPlan}>
              {generatingPlan ? 'Generating…' : 'Generate Success Plan'}
            </Button>
            {successPlan && (
              <div className="mt-3 rounded-[var(--radius-liquid)] bg-[var(--glass-bg)] p-3 text-body-sm">
                <p>Health score: {successPlan.health_score} · Status: {successPlan.status}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
