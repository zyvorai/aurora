/** User-safe messages for workflow / LLM failures shown in UI. */

const TOKEN_LIMIT_RE = /request too large|tokens per minute|rate_limit|413/i;
const OOM_RE = /signal: killed|out of memory/i;

export function sanitizeWorkflowError(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'Workflow failed';
  const msg = raw.trim();

  if (TOKEN_LIMIT_RE.test(msg)) {
    return 'The AI request was too large for the current model limit. Retry after sources are ingested, or ask your admin to use a higher-tier LLM provider.';
  }
  if (OOM_RE.test(msg)) {
    return 'The AI model ran out of memory on the server. Try a smaller model or retry later.';
  }
  if (msg.length > 280) {
    const first = msg.split(/[.!?\n]/)[0]?.trim();
    if (first && first.length <= 200) return first;
    return `${msg.slice(0, 200)}…`;
  }
  return msg;
}
