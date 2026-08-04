'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import {
  AGENT_TASK_CONFIG,
  formatTaskElapsed,
  type AgentTaskId,
} from '@/lib/agent-tasks';

interface AgentTaskProgressProps {
  task: AgentTaskId;
  detail?: string;
  className?: string;
}

export default function AgentTaskProgress({ task, detail, className }: AgentTaskProgressProps) {
  const config = AGENT_TASK_CONFIG[task];
  const [elapsed, setElapsed] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setElapsed(0);
    setStepIndex(0);
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    const advance = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, config.steps.length - 1));
    }, 9000);
    return () => {
      clearInterval(tick);
      clearInterval(advance);
    };
  }, [task, config.steps.length]);

  const progressPct = Math.min(
    95,
    Math.round(((stepIndex + 1) / config.steps.length) * 100),
  );

  return (
    <Card elevated className={cn('border-primary/30 overflow-hidden', className)}>
      <CardBody className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0 mt-0.5">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 border border-primary/40">
              <Loader2 className="h-5 w-5 text-primary animate-spin" aria-hidden />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{config.title}</p>
            <p className="text-sm text-muted mt-0.5">{config.subtitle}</p>
            {detail && (
              <p className="text-xs text-primary/80 mt-2 truncate font-mono" title={detail}>
                {detail}
              </p>
            )}
          </div>
          <span className="text-xs text-muted tabular-nums shrink-0">{formatTaskElapsed(elapsed)}</span>
        </div>

        <div>
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2">{progressPct}% — still working…</p>
        </div>

        <ol className="space-y-2" aria-label="Task progress steps">
          {config.steps.map((step, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li
                key={step}
                className={cn(
                  'flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-colors',
                  active && 'bg-primary/10 text-foreground',
                  done && !active && 'text-muted',
                  !done && !active && 'text-muted/50',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                    done && 'border-success/50 bg-success/15 text-success',
                    active && 'border-primary bg-primary/20 text-primary',
                    !done && !active && 'border-border',
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                </span>
                <span className={cn(active && 'font-medium')}>{step}</span>
              </li>
            );
          })}
        </ol>

        {config.hint && (
          <p className="text-xs text-muted border-t border-border pt-3">{config.hint}</p>
        )}
      </CardBody>
    </Card>
  );
}
