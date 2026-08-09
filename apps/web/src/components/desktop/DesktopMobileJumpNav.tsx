'use client';

import { useRouter } from 'next/navigation';
import { getFlatNavItems } from '@/lib/nav-data';
import type { AppRole } from '@/lib/role-routing';

interface DesktopMobileJumpNavProps {
  hasProduct: boolean;
  role: AppRole | null;
  productId: string;
}

/** <select>-based nav fallback below the lg breakpoint, where the Finder sidebar is
 * hidden entirely. */
export function DesktopMobileJumpNav({ hasProduct, role, productId }: DesktopMobileJumpNavProps) {
  const router = useRouter();
  const items = getFlatNavItems(hasProduct, role);

  return (
    <div className="lg:hidden px-3 py-2 border-b border-[var(--glass-border)]">
      <select
        onChange={(e) => {
          if (e.target.value) router.push(e.target.value);
        }}
        defaultValue=""
        className="w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-md px-3 py-2 text-body-sm text-foreground focus-ring"
        aria-label="Navigate"
      >
        <option value="" disabled>
          Jump to…
        </option>
        {items.map(({ group, item }) => (
          <option key={item.id} value={item.href(productId)}>
            {group} — {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
