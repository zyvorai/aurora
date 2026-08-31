import type { ProductSource } from '@/lib/api';

const IP_V4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function isIpHost(hostname: string): boolean {
  return IP_V4.test(hostname);
}

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

/** Full URL for opening in a new tab, or null when not linkable. */
export function resolveSourceHref(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey?.trim()) return null;
  const raw = urlOrKey.trim();
  if (/^(s3|file|gs|azure):\/\//i.test(raw)) return null;
  const parsed = parseUrl(raw);
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) return null;
  return parsed.href;
}

export interface SourceDisplay {
  label: string;
  hint: string | null;
  href: string | null;
}

/** Human-readable label + optional hint (IP host) + link target. */
export function formatSourceDisplay(urlOrKey: string | null | undefined): SourceDisplay {
  if (!urlOrKey?.trim()) {
    return { label: '', hint: null, href: null };
  }

  const raw = urlOrKey.trim();
  const href = resolveSourceHref(raw);

  const parsed = parseUrl(raw);
  if (parsed) {
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    const hostname = parsed.hostname;

    if (isIpHost(hostname)) {
      const pathLabel = path ? path.replace(/^\//, '') : null;
      return {
        label: pathLabel || hostname,
        hint: pathLabel ? hostname : parsed.port ? `${hostname}:${parsed.port}` : null,
        href,
      };
    }

    return {
      label: `${hostname}${path}`.replace(/\/$/, ''),
      hint: null,
      href,
    };
  }

  const truncated = raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
  return { label: truncated, hint: null, href: null };
}

export function formatSourcePath(urlOrKey: string | null | undefined): string {
  return formatSourceDisplay(urlOrKey).label;
}

export function normalizeSourceKey(source: ProductSource): string {
  const loc = (source.url ?? source.storage_key ?? source.display_name ?? source.id).toLowerCase();
  return formatSourcePath(loc) || loc;
}

export interface SourceGroup {
  key: string;
  primary: ProductSource;
  duplicates: ProductSource[];
}

/** Collapse duplicate URLs in the UI — keeps the most recently updated row as primary. */
export function groupSources(sources: ProductSource[]): SourceGroup[] {
  const map = new Map<string, ProductSource[]>();
  for (const s of sources) {
    const key = normalizeSourceKey(s);
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }

  return [...map.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => {
      const score = (s: ProductSource) =>
        (s.status === 'completed' ? 2 : 0) + (s.pages_processed > 0 ? 1 : 0);
      return score(b) - score(a);
    });
    return { key, primary: sorted[0], duplicates: sorted.slice(1) };
  });
}
