'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { products, type InboundEmbedConfig } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextMuted } from '@/components/ui/Typography';
import { WorkspacePanel } from '@/components/layout/WorkspacePanel';
import forgeStyles from '@/components/workflow/forge.module.css';

export function InboundEmbedPanel({ productId }: { productId: string }) {
  const [config, setConfig] = useState<InboundEmbedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'iframe' | 'link' | null>(null);

  useEffect(() => {
    products.inboundEmbedConfig(productId)
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [productId]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = useMemo(() => {
    if (!config) return '';
    const params = new URLSearchParams({
      product: config.product_id,
      key: config.embed_key,
    });
    return `${origin}/embed/inbound?${params.toString()}`;
  }, [config, origin]);

  const iframeSnippet = useMemo(() => {
    if (!embedUrl) return '';
    return `<iframe src="${embedUrl}" width="100%" height="520" style="border:0;border-radius:12px" title="Contact us"></iframe>`;
  }, [embedUrl]);

  async function copyText(text: string, kind: 'iframe' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      showToast('success', 'Copied to clipboard.');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast('error', 'Could not copy.');
    }
  }

  const previewSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    showToast('success', 'Preview only — use the embed link on your site for live submissions.');
  }, []);

  if (loading) {
    return (
      <WorkspacePanel title="Inbound form">
        <div className="px-5 py-6"><TextMuted>Loading embed config…</TextMuted></div>
      </WorkspacePanel>
    );
  }

  if (!config) {
    return (
      <WorkspacePanel title="Inbound form">
        <div className="px-5 py-6"><TextMuted>Could not load embed configuration.</TextMuted></div>
      </WorkspacePanel>
    );
  }

  return (
    <WorkspacePanel
      title="Inbound form"
      description="Embed on your site — leads are enriched, scored, and routed to a rep."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => copyText(embedUrl, 'link')}>
            {copied === 'link' ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            Copy link
          </Button>
          <Button size="sm" variant="secondary" onClick={() => copyText(iframeSnippet, 'iframe')}>
            {copied === 'iframe' ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            Copy embed
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2 p-5">
        <div className="space-y-3">
          <p className="text-[13px] text-muted">Live preview (styling matches the public embed)</p>
          <div className={forgeStyles.spotlight}>
            <form onSubmit={previewSubmit} className="space-y-3">
              <h3 className={forgeStyles.spotlightTitle}>Contact {config.product_name}</h3>
              <Input name="email" type="email" placeholder="Work email" required />
              <Input name="name" placeholder="Full name" />
              <Input name="company" placeholder="Company" />
              <Input name="title" placeholder="Title" />
              <Button type="submit" className="w-full">Request demo</Button>
            </form>
          </div>
        </div>
        <div className="space-y-3 min-w-0">
          <p className="text-[13px] font-medium text-foreground">Embed snippet</p>
          <pre className="text-[11px] leading-relaxed p-3 rounded-xl border border-border bg-[var(--app-canvas)] overflow-x-auto whitespace-pre-wrap break-all">
            {iframeSnippet}
          </pre>
          <p className="text-[12px] text-muted">
            Submissions hit <code className="text-[11px]">POST /public/inbound</code> with your embed key.
            No login required for visitors.
          </p>
        </div>
      </div>
    </WorkspacePanel>
  );
}
