'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, ChevronUp, Lock, X } from 'lucide-react';
import { products } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Text, TextMuted, TextSmall } from '@/components/ui/Typography';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'onboarding_checklist_dismissed';
const POLL_MS = 30_000;

interface Step {
  key: string;
  title: string;
  done: boolean;
  locked: boolean;
  hint: string;
  href?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface OnboardingChecklistProps {
  hasProduct: boolean;
  firstProductId?: string;
  onCreateProduct?: () => void;
}

export default function OnboardingChecklist({
  hasProduct,
  firstProductId,
  onCreateProduct,
}: OnboardingChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [sourceIngested, setSourceIngested] = useState(false);
  const [agentRun, setAgentRun] = useState(false);

  const load = useCallback(() => {
    if (!firstProductId) return;
    products.listSources(firstProductId)
      .then((sources) => setSourceIngested(sources.some((s) => s.status === 'completed')))
      .catch(() => {});
    products.artifacts(firstProductId)
      .then((artifacts) => setAgentRun(artifacts.length > 0))
      .catch(() => {});
  }, [firstProductId]);

  useEffect(() => {
    if (dismissed || !firstProductId) return;
    load();
    const interval = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(interval);
  }, [dismissed, firstProductId, load]);

  const steps = useMemo<Step[]>(() => [
    {
      key: 'product',
      title: 'Create your first product',
      done: hasProduct,
      locked: false,
      hint: 'Paste a website or docs URL — Aurora builds a product profile from it.',
      actionLabel: 'Create product',
      onAction: onCreateProduct,
    },
    {
      key: 'ingest',
      title: 'Add and ingest a source',
      done: sourceIngested,
      locked: !hasProduct,
      hint: 'Sources build the knowledge base agents ground their answers in.',
      href: firstProductId ? `/products/${firstProductId}` : undefined,
      actionLabel: 'Add a source',
    },
    {
      key: 'agent',
      title: 'Run your first agent',
      done: agentRun,
      locked: !hasProduct || !sourceIngested,
      hint: 'Generate a strategy, Q&A answer, or proposal to see it in action.',
      href: firstProductId ? `/products/${firstProductId}` : undefined,
      actionLabel: 'Open product',
    },
  ], [hasProduct, sourceIngested, agentRun, firstProductId, onCreateProduct]);

  const completedCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done && !s.locked) ?? steps.find((s) => !s.done);

  useEffect(() => {
    if (completedCount === steps.length && !dismissed) {
      setDismissed(true);
      localStorage.setItem(STORAGE_KEY, '1');
    }
  }, [completedCount, steps.length, dismissed]);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  if (dismissed) return null;

  return (
    <div className="animate-fade-up apple-card px-5 py-5 sm:px-6 sm:py-6">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Text className="font-semibold text-[21px] tracking-[-0.02em]">
              {hasProduct ? 'Getting started' : 'Start here'}
            </Text>
            <TextMuted className="mt-1 text-body-sm">
              {hasProduct
                ? `${completedCount} of ${steps.length} complete`
                : 'Create a product first. Everything else unlocks after that.'}
            </TextMuted>
            {hasProduct ? (
              <div className="mt-3 h-1 rounded-full bg-[var(--app-canvas)] overflow-hidden border border-border">
                <div
                  className="h-full rounded-full bg-[var(--accent-blue)] transition-all duration-500"
                  style={{ width: `${(completedCount / steps.length) * 100}%` }}
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            {hasProduct ? (
              <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {!collapsed && nextStep && !nextStep.done ? (
          <div className="rounded-[12px] bg-[var(--app-canvas)] px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between border border-border">
            <div className="min-w-0">
              <TextSmall className="text-[var(--accent-blue)] font-medium">Next up</TextSmall>
              <p className="text-[17px] font-semibold tracking-tight mt-0.5">{nextStep.title}</p>
              <TextMuted className="text-body-sm mt-1">{nextStep.hint}</TextMuted>
            </div>
            {nextStep.onAction ? (
              <Button className="shrink-0" onClick={nextStep.onAction}>
                {nextStep.actionLabel}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : nextStep.href ? (
              <Link href={nextStep.href} className="shrink-0">
                <Button>
                  {nextStep.actionLabel}
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}

        {!collapsed && (
          <ol className="space-y-1">
            {steps.map((step, index) => {
              const interactive = !step.done && !step.locked && (step.onAction || step.href);
              const content = (
                <>
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      step.done && 'bg-[var(--accent-sage)] text-white',
                      !step.done && !step.locked && 'bg-[var(--accent-blue)] text-white',
                      step.locked && 'bg-surface text-muted',
                    )}
                    aria-hidden
                  >
                    {step.done ? <Check className="h-3.5 w-3.5" /> : step.locked ? <Lock className="h-3 w-3" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-body-sm font-medium', step.done && 'text-muted line-through')}>
                      {step.title}
                    </p>
                    {!step.done && (
                      <TextMuted className="text-body-sm mt-0.5">
                        {step.locked ? 'Complete the previous step first.' : step.hint}
                      </TextMuted>
                    )}
                  </div>
                  {interactive ? (
                    <span className="text-body-sm text-[var(--accent-blue)] font-medium shrink-0 inline-flex items-center gap-1">
                      {step.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </>
              );

              if (step.onAction && interactive) {
                return (
                  <li key={step.key}>
                    <button
                      type="button"
                      onClick={step.onAction}
                      className="w-full flex items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface transition-colors"
                    >
                      {content}
                    </button>
                  </li>
                );
              }

              if (step.href && interactive) {
                return (
                  <li key={step.key}>
                    <Link
                      href={step.href}
                      className="flex items-start gap-3 rounded-xl px-2 py-3 hover:bg-surface transition-colors"
                    >
                      {content}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={step.key} className="flex items-start gap-3 rounded-xl px-2 py-3">
                  {content}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
