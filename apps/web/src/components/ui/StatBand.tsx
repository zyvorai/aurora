import { cn } from '@/lib/cn';

export interface StatBandItem {
  label: string;
  value: string | number;
  /** Tone only when the value genuinely deviates (or is confirmed good). Nominal values stay graphite. */
  tone?: 'success' | 'warning' | 'danger';
  hint?: string;
}

const TONE: Record<NonNullable<StatBandItem['tone']>, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

/** Hairline metric band — replaces card grids of KPI tiles. Wraps to two columns on phones. */
export function StatBand({ items, className }: { items: StatBandItem[]; className?: string }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--hairline)] py-5 sm:grid-flow-col sm:auto-cols-fr',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dd className={cn('text-[length:var(--fs-figure)] font-semibold tabular-nums leading-tight', item.tone ? TONE[item.tone] : 'text-foreground')}>
            {item.value}
          </dd>
          <dt className="mt-1 text-[length:var(--fs-micro)] text-muted">{item.label}</dt>
          {item.hint && <p className="mt-0.5 text-[length:var(--fs-micro)] text-muted">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
