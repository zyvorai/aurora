'use client';

import { useEffect, useState } from 'react';
import { Plus, ShieldAlert, Trash2, Workflow } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/lib/toast';
import { PageHero } from '@/components/layout/PageHero';
import { Card, CardBody } from '@/components/ui/Card';
import { SkeletonHero, SkeletonTable } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { TextSmall } from '@/components/ui/Typography';
import { cn } from '@/lib/cn';
import { workflowStages, type StageBlock, type WorkflowStage, type WorkflowStageInput } from '@/lib/api';
import { TONE_CLASSES } from '@/lib/tone';
import type { Tone } from '@/components/layout/PageHero';
import { ALLOWED_STAGE_ICONS, ALLOWED_STAGE_ACTIONS, STAGE_ACTION_LABELS } from '@/lib/stage-icons';

const TONES = Object.keys(TONE_CLASSES) as Tone[];
const ICON_KEYS = Object.keys(ALLOWED_STAGE_ICONS);
const BLOCK_TYPES = ['markdown', 'link', 'callout', 'agent_action'] as const;
const BLOCK_TYPE_LABELS: Record<(typeof BLOCK_TYPES)[number], string> = {
  markdown: 'Text',
  link: 'Link',
  callout: 'Callout',
  agent_action: 'Run action',
};

function emptyBlock(type: (typeof BLOCK_TYPES)[number]): StageBlock {
  switch (type) {
    case 'markdown': return { type, body: '' };
    case 'link': return { type, label: '', href: '' };
    case 'callout': return { type, label: '', value: '', description: '' };
    case 'agent_action': return { type, action: ALLOWED_STAGE_ACTIONS[0], label: '', params: {} };
  }
}

function emptyForm(): WorkflowStageInput {
  return { group_label: '', label: '', icon: 'sparkles', tone: 'sky', position: 0, content_blocks: [] };
}

function BlockEditor({ blocks, onChange }: { blocks: StageBlock[]; onChange: (blocks: StageBlock[]) => void }) {
  function update(i: number, block: StageBlock) {
    onChange(blocks.map((b, idx) => (idx === i ? block : b)));
  }
  function remove(i: number) {
    onChange(blocks.filter((_, idx) => idx !== i));
  }
  const hasAction = blocks.some((b) => b.type === 'agent_action');

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <Card key={i}>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5 flex-wrap">
                {BLOCK_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={t === 'agent_action' && hasAction && block.type !== 'agent_action'}
                    onClick={() => update(i, emptyBlock(t))}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      block.type === t ? 'bg-primary text-primary-foreground border-primary' : 'text-muted border-border hover:text-foreground disabled:opacity-40 disabled:pointer-events-none',
                    )}
                  >
                    {BLOCK_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {block.type === 'markdown' && (
              <Textarea
                placeholder="Markdown content…"
                rows={4}
                value={block.body}
                onChange={(e) => update(i, { ...block, body: e.target.value })}
              />
            )}

            {block.type === 'link' && (
              <div className="grid sm:grid-cols-2 gap-2">
                <Input placeholder="Label" value={block.label} onChange={(e) => update(i, { ...block, label: e.target.value })} />
                <Input placeholder="https:// or /internal/path" value={block.href} onChange={(e) => update(i, { ...block, href: e.target.value })} />
              </div>
            )}

            {block.type === 'callout' && (
              <div className="grid sm:grid-cols-3 gap-2">
                <Input placeholder="Label" value={block.label} onChange={(e) => update(i, { ...block, label: e.target.value })} />
                <Input placeholder="Value" value={block.value} onChange={(e) => update(i, { ...block, value: e.target.value })} />
                <Input placeholder="Description (optional)" value={block.description ?? ''} onChange={(e) => update(i, { ...block, description: e.target.value })} />
              </div>
            )}

            {block.type === 'agent_action' && (
              <div className="space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <select
                    value={block.action}
                    onChange={(e) => update(i, { ...block, action: e.target.value })}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-body text-foreground focus-ring"
                  >
                    {ALLOWED_STAGE_ACTIONS.map((a) => (
                      <option key={a} value={a}>{STAGE_ACTION_LABELS[a]}</option>
                    ))}
                  </select>
                  <Input placeholder="Button label (optional)" value={block.label} onChange={(e) => update(i, { ...block, label: e.target.value })} />
                </div>
                <Textarea
                  placeholder='Preset params as JSON, e.g. {"question": "What is our pricing?"}'
                  rows={2}
                  value={JSON.stringify(block.params)}
                  onChange={(e) => {
                    try {
                      update(i, { ...block, params: JSON.parse(e.target.value || '{}') });
                    } catch {
                      // ignore invalid JSON while typing
                    }
                  }}
                />
                <TextSmall className="text-muted">
                  Common keys: query/architect → question, content → content_type + topic, outreach → company_url, proposal → scope.
                </TextSmall>
              </div>
            )}
          </CardBody>
        </Card>
      ))}

      <div className="flex gap-2 flex-wrap">
        {BLOCK_TYPES.map((t) => (
          <Button
            key={t}
            type="button"
            variant="secondary"
            size="sm"
            disabled={t === 'agent_action' && hasAction}
            onClick={() => onChange([...blocks, emptyBlock(t)])}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> {BLOCK_TYPE_LABELS[t]}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function WorkflowStagesAdminPage() {
  const { ready, role } = useAuth();
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WorkflowStage | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<WorkflowStageInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (role === 'admin') refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function refresh() {
    setLoading(true);
    workflowStages.list()
      .then(setStages)
      .catch((err) => showToast('error', err instanceof Error ? err.message : 'Failed to load workflow stages'))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(stage: WorkflowStage) {
    setEditing(stage);
    setForm({
      group_label: stage.group_label,
      label: stage.label,
      icon: stage.icon,
      tone: stage.tone,
      position: stage.position,
      content_blocks: stage.content_blocks,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) await workflowStages.update(editing.id, form);
      else await workflowStages.create(form);
      showToast('success', editing ? 'Stage updated' : 'Stage created');
      setShowModal(false);
      refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(stage: WorkflowStage) {
    try {
      await workflowStages.remove(stage.id);
      showToast('success', `Removed "${stage.label}"`);
      refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (!ready) {
    return (
      <div className="max-w-content mx-auto px-[var(--hs-gutter)] py-8 space-y-8">
        <SkeletonHero />
        <SkeletonTable />
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="max-w-content mx-auto px-[var(--hs-gutter)] py-8">
        <EmptyState icon={ShieldAlert} title="Admin access required" description="This page is restricted to admin users." />
      </div>
    );
  }

  const grouped = stages.reduce<Record<string, WorkflowStage[]>>((acc, s) => {
    (acc[s.group_label] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="max-w-content mx-auto px-[var(--hs-gutter)] py-8 space-y-8 animate-fade-up">
      <PageHero
        icon={Workflow}
        eyebrow="Admin"
        title="Workflow Stages"
        description="Custom stages your tenant sees in every product's Workspace sidebar, alongside the built-in ones. Enterprise plan only."
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> New stage</Button>}
      />

      {loading ? (
        <SkeletonTable />
      ) : stages.length === 0 ? (
        <EmptyState
          icon={Workflow}
          tone="sky"
          title="No custom stages yet"
          description="Add a stage to show tenant-specific content or a preset agent action in Workspace."
          actions={[{ label: 'New stage', onClick: openCreate }]}
        />
      ) : (
        Object.entries(grouped).map(([groupLabel, groupStages]) => (
          <section key={groupLabel}>
            <SectionHeader label="Group" title={groupLabel} />
            <Card elevated className="divide-y divide-border overflow-hidden">
              {groupStages
                .sort((a, b) => a.position - b.position)
                .map((stage) => {
                  const tone = TONE_CLASSES[stage.tone as Tone] ?? TONE_CLASSES.sky;
                  const Icon = ALLOWED_STAGE_ICONS[stage.icon] ?? ALLOWED_STAGE_ICONS.sparkles;
                  return (
                    <div key={stage.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn('w-8 h-8 flex items-center justify-center rounded-[7px] shrink-0', tone.bg, tone.text)}>
                          <Icon className="w-4 h-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{stage.label}</p>
                          <TextSmall className="text-muted">{stage.content_blocks.length} block{stage.content_blocks.length === 1 ? '' : 's'}</TextSmall>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(stage)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(stage)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </Card>
          </section>
        ))
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit stage' : 'New stage'} className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              placeholder="Group label (e.g. Onboarding)"
              required
              value={form.group_label}
              onChange={(e) => setForm({ ...form, group_label: e.target.value })}
            />
            <Input
              placeholder="Stage label (e.g. Welcome)"
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>

          <div>
            <TextSmall className="text-muted mb-1.5 block">Icon</TextSmall>
            <div className="flex flex-wrap gap-1.5">
              {ICON_KEYS.map((key) => {
                const Icon = ALLOWED_STAGE_ICONS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, icon: key })}
                    className={cn(
                      'w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] border transition-colors',
                      form.icon === key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <TextSmall className="text-muted mb-1.5 block">Color</TextSmall>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tone: t })}
                  aria-label={t}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-transform',
                    TONE_CLASSES[t].dot,
                    form.tone === t ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                />
              ))}
            </div>
          </div>

          <Input
            type="number"
            placeholder="Position (lower = earlier)"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: Number(e.target.value) || 0 })}
          />

          <div>
            <TextSmall className="text-muted mb-1.5 block">Content</TextSmall>
            <BlockEditor blocks={form.content_blocks} onChange={(content_blocks) => setForm({ ...form, content_blocks })} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
