import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type CalloutTone = 'info' | 'success' | 'warning';

const TONES: Record<CalloutTone, { box: string; icon: typeof Info }> = {
  info: { box: 'border-primary/30 bg-primary/10', icon: Info },
  success: { box: 'border-success/30 bg-success/10', icon: CheckCircle2 },
  warning: { box: 'border-warning/30 bg-warning/10', icon: AlertTriangle },
};

/** Colour is deviation: use `warning`/`success` only when the content really is one. */
export function Callout({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role="note" className={cn('flex items-start gap-3 rounded-[var(--radius-md)] border p-4', box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
      <div className="min-w-0 text-[length:var(--fs-small)] leading-relaxed text-foreground">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
