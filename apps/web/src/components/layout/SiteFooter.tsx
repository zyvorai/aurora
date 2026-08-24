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
      <div className="mx-auto max-w-[var(--hs-max-width)] px-[var(--hs-gutter)] py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-white text-[10px] font-bold">
              A
            </div>
            <span className="font-semibold text-sm text-foreground">Aurora</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">GTM Orchestration Platform</p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-xs font-semibold text-foreground mb-3">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-muted hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-[var(--hs-max-width)] px-[var(--hs-gutter)] py-4 flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs text-muted">Copyright © {new Date().getFullYear()} Aurora. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
