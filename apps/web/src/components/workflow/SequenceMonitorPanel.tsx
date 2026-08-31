'use client';

import { useCallback, useEffect, useState } from 'react';
import { products, type OutreachSequence, type SequenceStepInput } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { TextMuted } from '@/components/ui/Typography';
import { WorkspacePanel } from '@/components/layout/WorkspacePanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { Mail } from 'lucide-react';

function statusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'published' || status === 'sent') return 'success';
  if (status === 'failed') return 'warning';
  return 'default';
}

export function SequenceMonitorPanel({ productId }: { productId: string }) {
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftSteps, setDraftSteps] = useState<SequenceStepInput[]>([]);
  const [draftRecipient, setDraftRecipient] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    products.listSequences(productId)
      .then((res) => setSequences(res.sequences))
      .catch(() => setSequences([]))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(seq: OutreachSequence) {
    setEditingId(seq.parent_artifact_id);
    setDraftRecipient(seq.recipient ?? '');
    setDraftSteps(seq.steps.map((s) => ({ day: s.day, subject: s.subject, body: s.body })));
  }

  function updateStep(index: number, field: keyof SequenceStepInput, value: string | number) {
    setDraftSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addStep() {
    setDraftSteps((prev) => [...prev, { day: (prev.length + 1) * 3, subject: '', body: '' }]);
  }

  async function save() {
    if (!editingId) return;
    setSaving(true);
    try {
      await products.updateSequence(productId, editingId, {
        recipient: draftRecipient || undefined,
        steps: draftSteps,
      });
      showToast('success', 'Sequence updated.');
      setEditingId(null);
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspacePanel title="Email sequences" description="Follow-ups scheduled after outreach is published.">
      {loading ? (
        <div className="px-5 py-6"><TextMuted>Loading sequences…</TextMuted></div>
      ) : sequences.length === 0 ? (
        <div className="px-5 py-6">
          <EmptyState
            icon={Mail}
            title="No sequences yet"
            description="Publish an outreach artifact with follow-up steps to see scheduled emails here."
          />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sequences.map((seq) => {
            const isEditing = editingId === seq.parent_artifact_id;
            return (
              <div key={seq.parent_artifact_id} className="px-5 py-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium truncate">{seq.title}</p>
                    <p className="text-[12px] text-muted mt-0.5">
                      {seq.recipient ? `To: ${seq.recipient}` : 'No recipient'} · {seq.steps.length} steps
                    </p>
                  </div>
                  {!isEditing ? (
                    <Button size="sm" variant="secondary" onClick={() => startEdit(seq)}>Edit</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      value={draftRecipient}
                      onChange={(e) => setDraftRecipient(e.target.value)}
                      placeholder="Recipient email"
                    />
                    {draftSteps.map((step, i) => (
                      <div key={i} className="grid gap-2 p-3 rounded-xl border border-border bg-[var(--app-canvas)]">
                        <div className="flex gap-2 items-center">
                          <span className="text-[12px] text-muted w-16">Day {step.day}</span>
                          <Input
                            type="number"
                            min={1}
                            value={step.day}
                            onChange={(e) => updateStep(i, 'day', Number(e.target.value))}
                            className="w-20"
                          />
                        </div>
                        <Input
                          value={step.subject}
                          onChange={(e) => updateStep(i, 'subject', e.target.value)}
                          placeholder="Subject"
                        />
                        <textarea
                          value={step.body}
                          onChange={(e) => updateStep(i, 'body', e.target.value)}
                          placeholder="Body"
                          rows={3}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px]"
                        />
                      </div>
                    ))}
                    <Button size="sm" variant="secondary" onClick={addStep}>Add step</Button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {seq.steps.map((step) => (
                      <li key={step.step} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="min-w-0 truncate">
                          Day {step.day}: {step.subject || `Step ${step.step}`}
                        </span>
                        <Badge variant={statusVariant(step.status)}>{step.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </WorkspacePanel>
  );
}
