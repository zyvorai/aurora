'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { getNavGroups } from '@/lib/nav-data';
import { products, workflowStages, type ExecutiveBrief, type Product, type WorkflowStage } from '@/lib/api';
import { deriveChain, chainStageHref, type ChainStage } from '@/lib/chain';
import { RunLogDock } from '@/components/workflow/RunLogDock';
import CommandPalette, { type CommandPaletteItem } from '@/components/CommandPalette';
import { cn } from '@/lib/cn';

const STATUS_DOT: Record<ChainStage['status'], string> = {
  idle: 'bg-border',
  need: 'bg-warning',
  run: 'bg-primary',
  done: 'bg-success',
};

const SURFACES: { key: string; label: string }[] = [
  { key: 'query', label: 'Q&A' },
  { key: 'content', label: 'Content' },
  { key: 'chat', label: 'Sales chat' },
  { key: 'architect', label: 'Architect' },
  { key: 'analytics', label: 'Analytics' },
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
  const { theme, toggleTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <aside className="w-full lg:w-[212px] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-surface lg:sticky lg:top-0 lg:h-screen flex flex-row lg:flex-col gap-3 lg:gap-0 p-2.5 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 p-2 rounded-[var(--radius-sm)] border border-border hover:border-[var(--glass-border-strong)] transition-colors shrink-0"
        >
          <span className="w-[26px] h-[26px] shrink-0 flex items-center justify-center rounded-[7px] bg-foreground text-background font-mono text-xs font-semibold">
            {product?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </span>
          <span className="min-w-0 hidden sm:block">
            <span className="block text-body-sm font-semibold truncate max-w-[140px]">{product?.name ?? 'Loading…'}</span>
            <span className="block font-mono text-[10px] text-muted">product</span>
          </span>
        </Link>

        <div className="hidden lg:block mt-4 mb-1.5 px-2 font-mono text-[9.5px] uppercase tracking-widest text-muted">Pipeline</div>
        <nav className="flex flex-row lg:flex-col gap-1 lg:gap-px shrink-0">
          {stages.map((stage, i) => (
            <Link
              key={stage.id}
              href={chainStageHref(productId, stage.id)}
              className="flex items-center gap-2 lg:gap-2.5 px-2 py-1.5 rounded-[var(--radius-sm)] text-body-sm text-foreground/80 hover:bg-background transition-colors whitespace-nowrap"
            >
              <span className="font-mono text-[10px] text-muted w-[13px] shrink-0 hidden lg:inline">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 truncate">{stage.label}</span>
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[stage.status])} aria-hidden />
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block mt-4 mb-1.5 px-2 font-mono text-[9.5px] uppercase tracking-widest text-muted">Surfaces</div>
        <nav className="flex flex-row lg:flex-col gap-1 lg:gap-px shrink-0">
          {SURFACES.map((s) => (
            <Link
              key={s.key}
              href={`/products/${productId}?tab=${s.key}`}
              className="px-2 py-1.5 rounded-[var(--radius-sm)] text-body-sm text-foreground/80 hover:bg-background transition-colors whitespace-nowrap"
            >
              {s.label}
            </Link>
          ))}
        </nav>

        {customGroups.map((group) => (
          <div key={group.label} className="shrink-0 contents lg:block">
            <div className="hidden lg:block mt-4 mb-1.5 px-2 font-mono text-[9.5px] uppercase tracking-widest text-muted">{group.label}</div>
            <nav className="flex flex-row lg:flex-col gap-1 lg:gap-px shrink-0">
              {group.stages.map((stage) => (
                <Link
                  key={stage.id}
                  href={`/products/${productId}?tab=custom:${stage.id}`}
                  className="px-2 py-1.5 rounded-[var(--radius-sm)] text-body-sm text-foreground/80 hover:bg-background transition-colors whitespace-nowrap lg:truncate"
                >
                  {stage.label}
                </Link>
              ))}
            </nav>
          </div>
        ))}

        <div className="hidden lg:block mt-auto pt-2.5 border-t border-border font-mono text-[10.5px] text-muted leading-relaxed">
          emissary
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-30 backdrop-blur-xl backdrop-saturate-150 bg-[var(--nav-bg)] border-b border-[var(--nav-border)] px-5 py-2.5 flex items-center gap-3.5">
          <div className="flex gap-0.5 overflow-x-auto">
            {workspaceGroup?.items.map((item) => {
              const href = item.href(productId);
              const active = pathname === href;
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={cn(
                    'px-2.5 py-1.5 rounded-[7px] text-body-sm whitespace-nowrap transition-colors',
                    active ? 'bg-surface text-foreground font-medium shadow-sm ring-1 ring-border' : 'text-muted hover:bg-[var(--nav-hover-bg)] hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors focus-ring"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline font-mono text-[0.7rem] opacity-60">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-[30px] h-[30px] flex items-center justify-center rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors focus-ring"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-sm)] text-muted hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors focus-ring"
            >
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-background text-xs font-semibold uppercase">
                {role?.[0] ?? 'U'}
              </div>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {accountOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                <div role="menu" className="absolute right-0 top-full mt-2 w-56 border border-border bg-surface shadow-lg z-50 py-1">
                  {systemGroup?.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href(productId)}
                      onClick={() => setAccountOpen(false)}
                      className="block px-4 py-2 text-sm text-foreground hover:bg-background transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-background transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-1 min-w-0">
          <main className="flex-1 min-w-0">{children}</main>
          <RunLogDock productId={productId} />
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
    </div>
  );
}
