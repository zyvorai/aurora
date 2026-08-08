'use client';

import Link from 'next/link';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { personaLabel, defaultPersonaForRole, type AppRole } from '@/lib/role-routing';
import { resolveHealthUrl } from '@/lib/api-base';
import { useTheme } from '@/context/ThemeContext';

interface AppHeaderProps {
  productName?: string;
  role?: AppRole | null;
  /** When set, the persona badge links to the user's default workspace (e.g. Full Forge). */
  personaHref?: string;
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
  onSignOut?: () => void;
}

export function AppHeader({
  productName,
  role,
  personaHref,
  onMenuToggle,
  showMenuButton,
  onSignOut,
}: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const personaLabelText = role ? personaLabel(defaultPersonaForRole(role)) : null;

  const personaBadge = personaLabelText ? (
    <Badge
      variant="default"
      className={
        personaHref
          ? 'hidden sm:inline capitalize hover:border-primary/50 hover:text-foreground transition-colors'
          : 'hidden sm:inline capitalize'
      }
    >
      {personaLabelText}
    </Badge>
  ) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {showMenuButton && (
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={onMenuToggle}
              aria-label="Open navigation menu"
            >
              <span className="text-lg leading-none">☰</span>
            </Button>
          )}
          <Link href="/dashboard" className="flex flex-col min-w-0 focus-ring rounded-sm">
            <span className="text-eyebrow text-[10px]">Emissary</span>
            {productName ? (
              <span className="text-body font-semibold truncate">{productName}</span>
            ) : (
              <span className="text-body font-semibold">Dashboard</span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {personaBadge && (
            personaHref ? (
              <Link href={personaHref} className="focus-ring rounded-full">
                {personaBadge}
              </Link>
            ) : (
              personaBadge
            )
          )}
          <Link
            href="/dashboard"
            className="hidden sm:inline text-body-sm text-muted hover:text-foreground focus-ring rounded-sm px-2 py-1"
          >
            Products
          </Link>
          <Link
            href="/dashboard/settings"
            className="hidden sm:inline text-body-sm text-muted hover:text-foreground focus-ring rounded-sm px-2 py-1"
          >
            Settings
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {onSignOut && (
            <Button variant="ghost" size="sm" onClick={onSignOut} aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-content mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-body-sm">
        <div>
          <p className="font-medium mb-2">Platform</p>
          <ul className="space-y-1 text-muted">
            <li><Link href="/dashboard" className="hover:text-foreground focus-ring rounded-sm">Products</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-medium mb-2">Personas</p>
          <ul className="space-y-1 text-muted">
            <li>Brief · Sales · Pipeline</li>
            <li>Marketing · Partner · Forge</li>
          </ul>
        </div>
        <div>
          <p className="font-medium mb-2">Resources</p>
          <ul className="space-y-1 text-muted">
            <li><a href={resolveHealthUrl()} className="hover:text-foreground" target="_blank" rel="noreferrer">API health</a></li>
          </ul>
        </div>
        <div>
          <p className="font-medium mb-2">Emissary</p>
          <p className="text-muted text-xs font-medium">Enterprise GTM orchestration</p>
        </div>
      </div>
    </footer>
  );
}
