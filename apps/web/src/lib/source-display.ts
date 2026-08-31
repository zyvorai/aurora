import type { ProductSource } from '@/lib/api';

export function formatSourcePath(urlOrKey: string | null | undefined): string {
  if (!urlOrKey) return '';
  const raw = urlOrKey.trim();
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.hostname}${path}`.replace(/\/$/, '');
  } catch {
    return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
  }
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
