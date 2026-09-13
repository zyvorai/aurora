import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TypographyProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  id?: string;
};

export function Eyebrow({ children, className, as: Tag = 'p', id }: TypographyProps) {
  return <Tag id={id} className={cn('text-eyebrow', className)}>{children}</Tag>;
}

export function DisplayTitle({ children, className, as: Tag = 'h1', id }: TypographyProps) {
  return (
    <Tag
      id={id}
      className={cn('text-display font-semibold tracking-tight leading-tight', className)}
    >
      {children}
    </Tag>
  );
}

export function PageTitle({ children, className, as: Tag = 'h1', id }: TypographyProps) {
  return (
    <Tag
      id={id}
      className={cn('text-page-title font-semibold tracking-[-0.03em] leading-tight', className)}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, className, as: Tag = 'h2', id }: TypographyProps) {
  return (
    <Tag id={id} className={cn('text-tile font-semibold text-foreground tracking-tight', className)}>
      {children}
    </Tag>
  );
}

export function SubsectionTitle({ children, className, as: Tag = 'h3', id }: TypographyProps) {
  return (
    <Tag id={id} className={cn('text-body-lg font-semibold text-foreground', className)}>
      {children}
    </Tag>
  );
}

export function Text({ children, className, as: Tag = 'p' }: TypographyProps) {
  return <Tag className={cn('text-body text-foreground', className)}>{children}</Tag>;
}

export function TextMuted({ children, className, as: Tag = 'p' }: TypographyProps) {
  return <Tag className={cn('text-body text-muted', className)}>{children}</Tag>;
}

export function TextSmall({ children, className, as: Tag = 'p' }: TypographyProps) {
  return <Tag className={cn('text-body-sm text-muted', className)}>{children}</Tag>;
}

export function TextLead({ children, className, as: Tag = 'p' }: TypographyProps) {
  return (
    <Tag className={cn('text-[17px] text-muted leading-[1.47]', className)}>
      {children}
    </Tag>
  );
}

interface StatProps {
  label: string;
  value: string | number;
  className?: string;
  highlight?: boolean;
}

export function Stat({ label, value, className, highlight }: StatProps) {
  return (
    <div className={className}>
      <p className="text-stat-label">{label}</p>
      <p className={cn('text-stat-value mt-1', highlight && 'text-primary')}>{value}</p>
    </div>
  );
}

interface StatGridItem {
  label: string;
  value: string | number;
  /** CSS color for the value (e.g. `var(--accent-sage)`) — for the 'strip' variant's per-stat coloring. */
  color?: string;
}

interface StatGridProps {
  items: StatGridItem[];
  /** 'strip' — the bordered top-level dashboard strip. 'plain' — a borderless
   *  grid for stats nested inside another panel (e.g. an attribution
   *  breakdown). There is no shared 'panel'/KPI-strip variant yet — that
   *  call site (WorkspacePanel's KpiStrip, ExecutiveBriefView) is a larger,
   *  separate migration and still uses its own markup. */
  variant?: 'strip' | 'plain';
  className?: string;
}

export function StatGrid({ items, variant = 'strip', className }: StatGridProps) {
  if (variant === 'strip') {
    return (
      <div className={cn('apple-stat-strip', className)}>
        {items.map((item) => (
          <div key={item.label}>
            <p className="apple-stat-value" style={item.color ? { color: item.color } : undefined}>
              {item.value}
            </p>
            <p className="apple-stat-label">{item.label}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-4', className)}>
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-[20px] font-semibold tabular-nums" style={item.color ? { color: item.color } : undefined}>
            {item.value}
          </p>
          <p className="text-[12px] text-muted capitalize">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
