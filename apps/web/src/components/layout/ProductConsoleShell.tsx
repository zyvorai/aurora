'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, Blocks, CheckCircle2, ChevronsLeft, ChevronsRight, FileSignature,
  FileText, FolderOpen, Layers, MessagesSquare, MessageCircleQuestion, Rocket,
  Search, Send, Target, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useResizableRail } from '@/hooks/useResizableRail';
import { getNavGroups } from '@/lib/nav-data';
import { products, workers, workflowStages, type ExecutiveBrief, type Product, type WorkerStatus, type WorkflowStage } from '@/lib/api';
import { deriveChain, chainStageHref, type ChainStage, type ChainStageId } from '@/lib/chain';
import { RunLogDock } from '@/components/workflow/RunLogDock';
import CommandPalette, { type CommandPaletteItem } from '@/components/CommandPalette';
import { GlobalNav } from '@/components/layout/GlobalNav/GlobalNav';
import navStyles from '@/components/layout/GlobalNav/GlobalNav.module.css';
import { LicenseBanner } from '@/components/LicenseBanner';
import { cn } from '@/lib/cn';

const STATUS_DOT: Record<ChainStage['status'], string> = {
  idle: 'bg-border',
  need: 'bg-warning',
  run: 'bg-primary',
  done: 'bg-success',
};

const CHAIN_ICONS: Record<ChainStageId, LucideIcon> = {
  sources: FolderOpen,
  ingest: Layers,
  profile: FileText,
  strategy: Target,
  discover: Search,
  qualify: CheckCircle2,
  outreach: Send,
  proposal: FileSignature,
  publish: Rocket,
};

const SURFACES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'query', label: 'Q&A', icon: MessageCircleQuestion },
  { key: 'content', label: 'Content', icon: FileText },
  { key: 'chat', label: 'Sales chat', icon: MessagesSquare },
  { key: 'architect', label: 'Architect', icon: Blocks },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export function ProductConsoleShell({
  productId,
  product,
  children,
}: {
  productId: string;
  product: Product | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, signOut } = useAuth({ requireAuth: false });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [customStages, setCustomStages] = useState<WorkflowStage[]>([]);

  useKeyboardShortcut({ key: 'k', ctrlOrMeta: true, handler: () => setPaletteOpen(true) });

  useEffect(() => {
    let cancelled = false;
    const load = () => products.brief(productId).then((b) => !cancelled && setBrief(b)).catch(() => {});
    load();
    const id = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [productId]);

  useEffect(() => {
    // Tenant-defined custom stages (enterprise-plan only) -- a 403/404 here just
    // means the tenant isn't entitled or has none configured, not an error worth
    // surfacing to every user on every product page.
    workflowStages.list().then(setCustomStages).catch(() => setCustomStages([]));
  }, []);

  const rail = useResizableRail({ storageKey: 'ec-rail', defaultWidth: 212, min: 180, max: 320, collapsedWidth: 56, handleSide: 'right' });

  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => workers.status().then((s) => !cancelled && setWorkerStatus(s)).catch(() => {});
    load();
    const id = window.setInterval(load, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const customGroups = Object.values(
    customStages.reduce<Record<string, { label: string; stages: WorkflowStage[] }>>((acc, stage) => {
      const key = stage.group_label;
      if (!acc[key]) acc[key] = { label: key, stages: [] };
      acc[key].stages.push(stage);
      return acc;
    }, {}),
  ).map((group) => ({ ...group, stages: [...group.stages].sort((a, b) => a.position - b.position) }));

  const stages = deriveChain(brief?.gtm_readiness);
  const groups = getNavGroups(true, role);
  const workspaceGroup = groups.find((g) => g.id === 'workspace');
  const systemGroup = groups.find((g) => g.id === 'system');

  const paletteItems: CommandPaletteItem[] = (workspaceGroup?.items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    group: 'Workspace',
    keywords: item.label,
    icon: item.icon,
    onSelect: () => router.push(item.href(productId)),
  }));

  const accountItems =
    systemGroup?.items.map((item) => ({
      label: item.label,
      href: item.href(productId),
    })) ?? [];

  const workspaceSubnav = workspaceGroup ? (
    <div className={navStyles.subnavInner}>
      {workspaceGroup.items.map((item) => {
        const href = item.href(productId);
        const active = pathname === href;
        return (
          <Link
            key={item.id}
            href={href}
            className={cn(
              'px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              active ? 'border-primary text-foreground' : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  ) : null;

  const appMobileExtra = (
    <>
      {workspaceGroup ? (
        <>
          <div className={navStyles.sheetItem}>
            <div className={navStyles.sheetTop} aria-hidden>
              Workspace
            </div>
            <div className={navStyles.sheetSub} data-open="true">
              {workspaceGroup.items.map((item) => (
                <Link key={item.id} href={item.href(productId)}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
      {systemGroup ? (
        <>
          <div className={navStyles.sheetItem}>
            <div className={navStyles.sheetTop} aria-hidden>
              Account
            </div>
            <div className={navStyles.sheetSub} data-open="true">
              {systemGroup.items.map((item) => (
                <Link key={item.id} href={item.href(productId)}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LicenseBanner />
      <GlobalNav
        variant="app"
        roleInitial={role?.[0] ?? 'U'}
        accountItems={accountItems}
        onSearchClick={() => setPaletteOpen(true)}
        onSignOut={signOut}
        appMobileExtra={appMobileExtra}
        subnav={workspaceSubnav}
      />
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <aside
        style={{ '--rail-w': `${rail.effectiveWidth}px` } as CSSProperties}
        className="relative w-full lg:w-[var(--rail-w)] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-surface lg:sticky lg:top-[var(--nav-h)] lg:h-[calc(100vh-var(--nav-h))] flex flex-row lg:flex-col gap-3 lg:gap-0 p-2.5 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto"
      >
        <Link
          href="/dashboard"
          title={product?.name ?? undefined}
          className="flex items-center gap-2.5 p-2 rounded-[var(--radius-sm)] border border-border hover:border-[var(--glass-border-strong)] transition-colors shrink-0"
        >
          <span className="w-[26px] h-[26px] shrink-0 flex items-center justify-center rounded-[7px] bg-foreground text-background font-mono text-xs font-semibold">
            {product?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </span>
          {!rail.collapsed && (
            <span className="min-w-0 hidden sm:block">
              <span className="block text-body-sm font-semibold truncate max-w-[140px]">{product?.name ?? 'Loading…'}</span>
              <span className="block font-mono text-[10px] text-muted">product</span>
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={() => rail.setCollapsed((v) => !v)}
          aria-label={rail.collapsed ? 'Expand rail' : 'Collapse rail'}
          className="hidden lg:flex items-center justify-center h-6 w-6 shrink-0 rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-background transition-colors"
        >
          {rail.collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
        </button>

        {!rail.collapsed && (
          <div className="hidden lg:block mt-4 mb-1.5 px-2 font-mono text-[9.5px] uppercase tracking-widest text-muted">Pipeline</div>
        )}
        <nav className="flex flex-row lg:flex-col gap-1 lg:gap-px shrink-0">
          {stages.map((stage, i) => {
            const Icon = CHAIN_ICONS[stage.id];
            return (
              <Link
                key={stage.id}
                href={chainStageHref(productId, stage.id)}
                title={stage.label}
                className={cn(
                  'flex items-center gap-2 lg:gap-2.5 px-2 py-1.5 rounded-[var(--radius-sm)] text-body-sm text-foreground/80 hover:bg-surface-elevated transition-colors whitespace-nowrap',
                  rail.collapsed && 'lg:justify-center',
                )}
              >
                {rail.collapsed ? (
                  <Icon className="w-4 h-4 shrink-0 hidden lg:block" />
                ) : (
                  <span className="font-mono text-[10px] text-muted w-[13px] shrink-0 hidden lg:inline">{String(i + 1).padStart(2, '0')}</span>
                )}
                <span className={cn('min-w-0 truncate', rail.collapsed && 'lg:hidden')}>{stage.label}</span>
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[stage.status])} aria-hidden />
              </Link>
            );
          })}
        </nav>

        {!rail.collapsed && (
          <div className="hidden lg:block mt-4 mb-1.5 px-2 font-mono text-[9.5px] uppercase tracking-widest text-muted">Surfaces</div>
        )}
        <nav className="flex flex-row lg:flex-col gap-1 lg:gap-px shrink-0">
          {SURFACES.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.key}
                href={`/products/${productId}?tab=${s.key}`}
                title={s.label}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-body-sm text-foreground/80 hover:bg-background transition-colors whitespace-nowrap',
                  rail.collapsed && 'lg:justify-center',
                )}
              >
                <Icon className="w-4 h-4 shrink-0 hidden lg:block" />
                <span className={cn(rail.collapsed && 'lg:hidden')}>{s.label}</span>
              </Link>
            );
          })}
        </nav>

        {customGroups.map((group) => (
          <div key={group.label} className="shrink-0 contents lg:block">
            {!rail.collapsed && (
              <div className="hidden lg:block mt-4 mb-1.5 px-2 font-mono text-[9.5px] uppercase tracking-widest text-muted">{group.label}</div>
            )}
            <nav className="flex flex-row lg:flex-col gap-1 lg:gap-px shrink-0">
              {group.stages.map((stage) => (
                <Link
                  key={stage.id}
                  href={`/products/${productId}?tab=custom:${stage.id}`}
                  title={stage.label}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-body-sm text-foreground/80 hover:bg-background transition-colors whitespace-nowrap lg:truncate',
                    rail.collapsed && 'lg:justify-center',
                  )}
                >
                  {rail.collapsed && (
                    <span className="hidden lg:flex w-4 h-4 shrink-0 items-center justify-center rounded-full bg-background text-[9px] font-mono">
                      {stage.label.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={cn(rail.collapsed && 'lg:hidden')}>{stage.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}

        {!rail.collapsed && (
          <div className="hidden lg:block mt-auto pt-2.5 border-t border-border font-mono text-[10.5px] text-muted leading-relaxed">
            {workerStatus?.healthy ? (
              <>
                workers {workerStatus.idle} idle
                <br />
                queue {workerStatus.queued === 0 ? 'empty' : `${workerStatus.queued} queued`}
              </>
            ) : (
              'workers —'
            )}
            <br />
            aurora
          </div>
        )}

        {!rail.collapsed && (
          <div
            onMouseDown={rail.startDrag}
            className="hidden lg:block absolute top-0 bottom-0 right-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors"
            aria-hidden
          />
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex flex-1 min-w-0 min-h-0">
          <main className="flex-1 min-w-0 bg-background">{children}</main>
          <RunLogDock productId={productId} />
        </div>
      </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
    </div>
  );
}
