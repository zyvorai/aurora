/** Shared API base resolution — used by api.ts and ChatWidget. */

function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

export function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configured) return configured;

  if (typeof window !== 'undefined' && isLocalDevHost(window.location.hostname)) {
    return 'http://127.0.0.1:8000/api/v1';
  }

  return '/api/v1';
}

/** /health is mounted at the API root, not under /api/v1 -- derive it from the same base. */
export function resolveHealthUrl(): string {
  const base = resolveApiBase();
  const root = base.replace(/\/api\/v1$/, '').replace(/\/api$/, '');
  return `${root}/health`;
}
