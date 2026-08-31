import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from '@/components/workflow/forge.module.css';

export function WorkspacePage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-8 animate-fade-up', className)}>{children}</div>;
}

export function WorkspacePanel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(styles.panel, className)}>
      <div className={styles.panelHeader}>
        <div className="min-w-0">
          <h2 className={styles.panelTitle}>{title}</h2>
          {description ? <p className={styles.panelDesc}>{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function WorkspaceRow({
  title,
  description,
  meta,
  actions,
  onClick,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className={styles.sourceName}>{title}</p>
        {description ? <p className={styles.sourceUrl}>{description}</p> : null}
      </div>
      {meta ? <div className="shrink-0">{meta}</div> : null}
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(styles.sourceRow, 'w-full text-left hover:bg-surface/80 transition-colors')}>
        {inner}
      </button>
    );
  }

  return <div className={styles.sourceRow}>{inner}</div>;
}

export function KpiStrip({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className={styles.kpiStrip}>
      {items.map((item) => (
        <div key={item.label} className={styles.kpiItem}>
          <p className={styles.kpiValue}>{item.value}</p>
          <p className={styles.kpiLabel}>{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceTabPills<T extends string>({
  tabs,
  active,
  onChange,
  labels,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className={styles.tabPills} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={cn(styles.tabPill, active === tab && styles.tabPillActive)}
        >
          {labels[tab]}
        </button>
      ))}
    </div>
  );
}

export function WorkspaceFilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.filterBar, className)}>{children}</div>;
}
