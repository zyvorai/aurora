import Link from 'next/link';

const FOOTER_COLUMNS = [
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
      { label: 'Create workspace', href: '/login' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-[var(--hs-bg-alt)] border-t border-border mt-auto">
      <div className="mx-auto max-w-[var(--hs-max-width)] px-[var(--hs-gutter)] pt-12 pb-8 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <p className="text-[21px] font-semibold tracking-[-0.02em] text-foreground mb-2">Aurora</p>
          <p className="text-[12px] text-muted leading-relaxed">GTM orchestration</p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-[12px] font-semibold text-foreground mb-3">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={`${col.title}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-[12px] text-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-[var(--hs-max-width)] px-[var(--hs-gutter)] py-4">
          <span className="text-[12px] text-muted">
            Copyright © {new Date().getFullYear()} Aurora. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
