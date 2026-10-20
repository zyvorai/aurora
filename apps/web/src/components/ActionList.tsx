'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { actions, type ActionItem, type ActionKind, type ActionList as ActionListData } from '@/lib/api';
import { WorkspacePanel } from '@/components/layout/WorkspacePanel';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { TextMuted, TextSmall } from '@/components/ui/Typography';

const KINDS: Record<ActionKind, { label: string; variant: BadgeVariant }> = {
  stale_proof: { label: 'Out of date', variant: 'danger' },
  stale_artifact: { label: 'Out of date', variant: 'danger' },
  proof_review: { label: 'Review', variant: 'warning' },
  needs_answer: { label: 'Needs answer', variant: 'purple' },
  artifact_review: { label: 'Approval', variant: 'blue' },
  follow_up: { label: 'Follow up', variant: 'default' },
};

const VISIBLE = 8;

/** Daily action list: what needs a person's attention across deals and drafts. */
export default function ActionList({ productId }: { productId?: string }) {
  const [data, setData] = useState<ActionListData | null>(null);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    actions.list(productId).then(setData).catch(() => setError(true));
  }, [productId]);

  // The list is a convenience: if it cannot load, stay out of the way of the page.
  if (error) return null;

  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const items = data ? (showAll ? data.items : data.items.slice(0, VISIBLE)) : [];

  return (
    <WorkspacePanel
      title={data && total > 0 ? `Needs attention (${total})` : 'Needs attention'}
      description="Out-of-date answers first, then reviews, unanswered requirements and quiet deals."
      bodyClassName="p-4"
    >
      {!data ? (
        <TextMuted>Loading…</TextMuted>
      ) : data.items.length === 0 ? (
        <div className="flex items-center gap-2 text-muted">
          <CheckCircle2 size={18} aria-hidden /> Nothing waiting on you.
        </div>
      ) : (
        <>
          <ul className="m-0 list-none space-y-2 p-0">
            {items.map((item) => (
              <ActionRow key={item.id} item={item} showProduct={!productId} />
            ))}
          </ul>
          {data.items.length > VISIBLE ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-[13px] text-[var(--accent-blue)] hover:underline"
            >
              {showAll ? 'Show fewer' : `Show all ${data.items.length}`}
            </button>
          ) : null}
          <TextSmall className="mt-3 block text-muted">
            A deal appears under “Follow up” after {data.follow_up_after_days} days with no logged activity.
          </TextSmall>
        </>
      )}
    </WorkspacePanel>
  );
}

function ActionRow({ item, showProduct }: { item: ActionItem; showProduct: boolean }) {
  const kind = KINDS[item.kind];
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-border p-3 hover:bg-[var(--nav-hover-bg)]"
      >
        <Badge variant={kind.variant} className="mt-0.5 shrink-0">{kind.label}</Badge>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">{item.title}</span>
          <TextSmall className="text-muted">{item.detail}</TextSmall>
        </span>
        <TextSmall className="shrink-0 text-right text-muted">
          {showProduct ? <span className="block">{item.product_name}</span> : null}
          {item.age_days > 0 ? `${item.age_days}d` : 'today'}
        </TextSmall>
      </Link>
    </li>
  );
}
