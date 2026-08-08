'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Circle, X } from 'lucide-react';
import { products } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Text, TextMuted, TextSmall } from '@/components/ui/Typography';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'onboarding_checklist_dismissed';
const POLL_MS = 30_000;

interface Step {
  key: string;
  title: string;
  done: boolean;
  hint: string;
  href?: string;
}

interface OnboardingChecklistProps {
  hasProduct: boolean;
  firstProductId?: string;
}

export default function OnboardingChecklist({ hasProduct, firstProductId }: OnboardingChecklistProps) {
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
      hint: 'Point the platform at a website or docs URL.',
    },
    {
      key: 'ingest',
      title: 'Add and ingest a source',
      done: sourceIngested,
      hint: 'Sources build the knowledge base agents ground their answers in.',
      href: firstProductId ? `/products/${firstProductId}` : undefined,
    },
    {
      key: 'agent',
      title: 'Run your first agent',
      done: agentRun,
      hint: 'Generate a strategy, Q&A answer, or proposal to see it in action.',
      href: firstProductId ? `/products/${firstProductId}` : undefined,
    },
  ], [hasProduct, sourceIngested, agentRun, firstProductId]);

  const completedCount = steps.filter((s) => s.done).length;

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
    <Card elevated className="animate-fade-up border-primary/20">
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Text className="font-semibold">Getting started</Text>
            <TextSmall className="text-muted">{completedCount}/{steps.length} complete</TextSmall>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!collapsed && (
          <ul className="mt-4 space-y-3">
            {steps.map((step) => (
              <li key={step.key} className="flex items-start gap-3">
                {step.done ? (
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-[10px] text-white">✓</span>
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-body-sm font-medium', step.done && 'text-muted line-through')}>
                    {step.title}
                  </p>
                  {!step.done && (
                    <div className="flex items-center gap-2">
                      <TextMuted className="text-body-sm">{step.hint}</TextMuted>
                      {step.href && (
                        <Link href={step.href} className="text-body-sm text-primary hover:underline">
                          Go →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
