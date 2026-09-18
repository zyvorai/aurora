'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';

const FOOTER_COLUMNS_PUBLIC = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Get started', href: '/login' },
    ],
  },
  {
    title: 'Portals',
    links: [
      { label: 'Customer', href: '/portal/customer/login' },
      { label: 'Reseller', href: '/portal/reseller/login' },
      { label: 'Sales', href: '/portal/salesperson/login' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
    ],
  },
];

const FOOTER_COLUMNS_AUTHED = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Portals',
    links: [
      { label: 'Customer', href: '/portal/customer/login' },
      { label: 'Reseller', href: '/portal/reseller/login' },
      { label: 'Sales', href: '/portal/salesperson/login' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Settings', href: '/dashboard/settings' },
    ],
  },
];

export function SiteFooter() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('token'));
  }, []);

  const columns = authed ? FOOTER_COLUMNS_AUTHED : FOOTER_COLUMNS_PUBLIC;

  return (
    <footer className="bg-[var(--hs-bg-alt)] border-t border-border mt-auto">
      <Container tier="marketing" className="pt-14 pb-10 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10">
        <div className="col-span-2 md:col-span-1">
          <p className="text-[19px] font-semibold tracking-[-0.03em] text-foreground mb-1.5">Aurora</p>
          <p className="text-[12px] text-[var(--hs-text-subtle)] leading-relaxed max-w-[18ch]">
            Turn your product into an AI salesperson.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-[12px] font-semibold text-foreground mb-3.5 tracking-[-0.01em]">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={`${col.title}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-[12px] text-[var(--hs-text-subtle)] hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <div className="border-t border-border">
        <Container tier="marketing" className="py-3.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--hs-text-subtle)]">
            Copyright © {new Date().getFullYear()} ZyvorAI Labs · Zyvor Production License v1.0 ·{' '}
            <a href="https://zyvor.dev" className="hover:text-foreground transition-colors">
              Commercial license
            </a>
          </span>
        </Container>
      </div>
    </footer>
  );
}
