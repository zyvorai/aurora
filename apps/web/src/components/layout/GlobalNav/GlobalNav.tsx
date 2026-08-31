'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, Search } from 'lucide-react';
import {
  NAV_CTA_HREF,
  NAV_CTA_LABEL,
  NAV_FLYOUT_DIRECT_LINKS,
  NAV_FLYOUT_PANELS,
  NAV_FLYOUT_TRIGGER_LABELS,
} from '@/lib/nav-flyout';
import { useTheme } from '@/context/ThemeContext';
import styles from './GlobalNav.module.css';

const CLOSE_DELAY_MS = 280;

function BurgerIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
      <path d="M2 5.5h13M2 11.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="9" height="14" viewBox="0 0 9 14" fill="none" aria-hidden="true">
      <path d="M1.5 1L7 7l-5.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SignInIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.4" r="2.8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.6 14c.7-2.9 2.8-4.3 5.4-4.3S12.7 11.1 13.4 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.2v1.6M8 13.2v1.6M14.8 8h-1.6M2.8 8H1.2M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4 3.3 3.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.6 9.6A5.8 5.8 0 0 1 6.4 2.4a5.8 5.8 0 1 0 7.2 7.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Mark({ href }: { href: string }) {
  return (
    <Link className={styles.mark} href={href} aria-label="Aurora home">
      <span className={styles.markBadge}>A</span>
      <span className={styles.word}>aurora</span>
    </Link>
  );
}

export type GlobalNavAccountItem = {
  label: string;
  href: string;
};

export type GlobalNavProps = {
  variant: 'marketing' | 'app' | 'portal';
  externalOpen?: boolean;
  homeHref?: string;
  portalLabel?: string;
  roleInitial?: string;
  accountItems?: GlobalNavAccountItem[];
  onSearchClick?: () => void;
  onSignOut?: () => void;
  appMobileExtra?: ReactNode;
  subnav?: ReactNode;
};

export function GlobalNav({
  variant,
  externalOpen = false,
  homeHref,
  portalLabel,
  roleInitial = 'U',
  accountItems = [],
  onSearchClick,
  onSignOut,
  appMobileExtra,
  subnav,
}: GlobalNavProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const showFlyout = variant === 'marketing';

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSection, setSheetSection] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [marketingAuthed, setMarketingAuthed] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const accountRef = useRef<HTMLDivElement>(null);

  const markHref = homeHref ?? (variant === 'app' ? '/dashboard' : marketingAuthed ? '/dashboard' : '/');
  const navOpen = Boolean(openKey) || sheetOpen || accountOpen || externalOpen;
  const marketingCtaHref = marketingAuthed ? '/dashboard' : NAV_CTA_HREF;
  const marketingCtaLabel = marketingAuthed ? 'Dashboard' : NAV_CTA_LABEL;

  const resolveMarketingLink = useCallback(
    (link: { label: string; to: string; sub?: string }) => {
      if (!marketingAuthed) return link;
      if (link.to === '/login') {
        return { label: 'Dashboard', to: '/dashboard', sub: 'Your products and workspace' };
      }
      return link;
    },
    [marketingAuthed],
  );

  const directLinks = marketingAuthed
    ? [{ label: 'Dashboard', to: '/dashboard' }, ...NAV_FLYOUT_DIRECT_LINKS]
    : NAV_FLYOUT_DIRECT_LINKS;

  useEffect(() => {
    if (variant !== 'marketing') return;
    setMarketingAuthed(typeof window !== 'undefined' && !!localStorage.getItem('token'));
  }, [variant, pathname]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenKey(null), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const handleTriggerClick = (key: string) => {
    setOpenKey((current) => (current === key ? null : key));
  };

  const handleTriggerEnter = (key: string) => {
    clearCloseTimer();
    setOpenKey(key);
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (accountOpen) setAccountOpen(false);
        if (openKey) {
          const key = openKey;
          setOpenKey(null);
          triggerRefs.current[key]?.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openKey, accountOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [accountOpen]);

  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  const toggleSheetSection = (key: string) => {
    setSheetSection((current) => (current === key ? null : key));
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setSheetSection(null);
  };

  return (
    <>
      <nav
        className={styles.gnav}
        aria-label="Global"
        data-open={String(navOpen)}
        onMouseLeave={showFlyout ? scheduleClose : undefined}
      >
        <div className={styles.gnavInner}>
          <Mark href={markHref} />
          {variant === 'portal' && portalLabel ? (
            <span className={styles.portalLabel}>{portalLabel}</span>
          ) : null}

          {showFlyout ? (
            <div className={styles.links}>
              {NAV_FLYOUT_PANELS.map((panel) => (
                <button
                  key={panel.key}
                  ref={(el) => {
                    triggerRefs.current[panel.key] = el;
                  }}
                  type="button"
                  className={styles.link}
                  aria-expanded={openKey === panel.key}
                  aria-controls="fly"
                  onClick={() => handleTriggerClick(panel.key)}
                  onMouseEnter={() => handleTriggerEnter(panel.key)}
                >
                  {NAV_FLYOUT_TRIGGER_LABELS[panel.key]}
                </button>
              ))}
              {directLinks.map((link) => (
                <Link
                  key={`${link.to}-${link.label}`}
                  className={styles.link}
                  href={link.to}
                  aria-current={pathname === link.to ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : variant === 'app' ? (
            <div className={styles.links}>
              <Link
                className={styles.link}
                href="/dashboard"
                aria-current={pathname === '/dashboard' ? 'page' : undefined}
              >
                Products
              </Link>
              <Link
                className={styles.link}
                href="/dashboard/settings"
                aria-current={pathname === '/dashboard/settings' ? 'page' : undefined}
              >
                Settings
              </Link>
              <Link
                className={styles.link}
                href="/features"
                aria-current={pathname === '/features' ? 'page' : undefined}
              >
                Features
              </Link>
            </div>
          ) : null}

          <div className={styles.utils}>
            {variant === 'app' && onSearchClick ? (
              <button type="button" className={styles.searchBtn} onClick={onSearchClick}>
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className={`hidden sm:inline ${styles.searchKbd}`}>⌘K</kbd>
              </button>
            ) : null}

            {variant === 'marketing' ? (
              marketingAuthed ? (
                <Link className={styles.link} href="/dashboard">
                  Products
                </Link>
              ) : (
                <Link className={styles.icon} href="/login" aria-label="Sign in">
                  <SignInIcon />
                </Link>
              )
            ) : null}

            {variant === 'marketing' || variant === 'app' || variant === 'portal' ? (
              <button
                type="button"
                className={styles.icon}
                onClick={toggleTheme}
                aria-pressed={isDark}
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
                title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
              >
                {isDark ? <SunIcon /> : <MoonIcon />}
              </button>
            ) : null}

            {variant === 'app' ? (
              <div ref={accountRef} className={`${styles.accountWrap} hidden md:block`}>
                <button
                  type="button"
                  className={styles.accountBtn}
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  <span className={styles.accountAvatar}>{roleInitial}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {accountOpen ? (
                  <div role="menu" className={styles.accountMenu}>
                      {accountItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={styles.accountMenuItem}
                          onClick={() => setAccountOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                      {accountItems.length > 0 ? <div className={styles.accountMenuDivider} /> : null}
                      {onSignOut ? (
                        <button type="button" className={styles.accountMenuDanger} onClick={onSignOut}>
                          <span className="inline-flex items-center gap-2">
                            <LogOut className="w-3.5 h-3.5" />
                            Sign out
                          </span>
                        </button>
                      ) : null}
                    </div>
                ) : null}
              </div>
            ) : null}

            {variant === 'portal' && onSignOut ? (
              <button type="button" className={styles.link} onClick={onSignOut}>
                Sign out
              </button>
            ) : null}

            {showFlyout ? (
              <Link className={styles.cta} href={marketingCtaHref}>
                {marketingCtaLabel}
              </Link>
            ) : null}

            {(showFlyout || variant === 'app') && (
              <button
                type="button"
                className={styles.burger}
                aria-expanded={sheetOpen}
                aria-controls="sheet"
                aria-label="Menu"
                onClick={() => setSheetOpen((v) => !v)}
              >
                <BurgerIcon />
              </button>
            )}
          </div>
        </div>

        {subnav ? <div className={styles.subnav}>{subnav}</div> : null}
      </nav>

      {showFlyout ? (
        <>
          <div
            className={styles.fly}
            id="fly"
            data-open={String(!!openKey)}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className={styles.flyInner}>
              {NAV_FLYOUT_PANELS.map((panel) => (
                <div
                  key={panel.key}
                  className={styles.flyPanel}
                  data-panel={panel.key}
                  data-active={openKey === panel.key}
                >
                  <div className={styles.flyCols}>
                    {panel.groups.map((group) => (
                      <div
                        key={group.heading}
                        className={group.lead ? `${styles.flyGroup} ${styles.flyLead}` : styles.flyGroup}
                      >
                        <h3>{group.heading}</h3>
                        <ul>
                          {group.links.map((link) => {
                            const resolved = resolveMarketingLink(link);
                            return (
                              <li key={`${resolved.to}-${resolved.label}`}>
                                <Link href={resolved.to} onClick={() => setOpenKey(null)}>
                                  {resolved.label}
                                  {resolved.sub ? <small>{resolved.sub}</small> : null}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.flyScrim} data-open={String(!!openKey)} onClick={() => setOpenKey(null)} />
        </>
      ) : null}

      {(showFlyout || variant === 'app') && (
        <div className={styles.sheet} id="sheet" data-open={String(sheetOpen)}>
          {showFlyout
            ? NAV_FLYOUT_PANELS.map((panel) => (
                <div key={panel.key} className={styles.sheetItem}>
                  <button
                    type="button"
                    className={styles.sheetTop}
                    aria-expanded={sheetSection === panel.key}
                    onClick={() => toggleSheetSection(panel.key)}
                  >
                    {NAV_FLYOUT_TRIGGER_LABELS[panel.key]}
                    <ChevronIcon />
                  </button>
                  <div className={styles.sheetSub} data-open={String(sheetSection === panel.key)}>
                    {panel.groups.flatMap((group) =>
                      group.links.map((link) => {
                        const resolved = resolveMarketingLink(link);
                        return (
                          <Link key={`${resolved.to}-${resolved.label}`} href={resolved.to} onClick={closeSheet}>
                            {resolved.label}
                          </Link>
                        );
                      }),
                    )}
                  </div>
                </div>
              ))
            : null}

          {variant === 'app' ? (
            <>
              <div className={styles.sheetItem}>
                <Link className={styles.sheetTop} href="/dashboard" onClick={closeSheet}>
                  Products
                </Link>
              </div>
              <div className={styles.sheetItem}>
                <Link className={styles.sheetTop} href="/dashboard/settings" onClick={closeSheet}>
                  Settings
                </Link>
              </div>
              <div className={styles.sheetItem}>
                <Link className={styles.sheetTop} href="/features" onClick={closeSheet}>
                  Features
                </Link>
              </div>
              {appMobileExtra}
            </>
          ) : null}

          {showFlyout ? (
            <>
              {NAV_FLYOUT_DIRECT_LINKS.map((link) => (
                <div key={link.to} className={styles.sheetItem}>
                  <Link className={styles.sheetTop} href={link.to} onClick={closeSheet}>
                    {link.label}
                  </Link>
                </div>
              ))}
              <div className={styles.sheetCta}>
                <Link className={styles.sheetCtaBtn} href={marketingCtaHref} onClick={closeSheet}>
                  {marketingCtaLabel}
                </Link>
                {!marketingAuthed ? (
                  <Link className={styles.sheetCtaBtn} href="/login" onClick={closeSheet}>
                    Sign in
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
