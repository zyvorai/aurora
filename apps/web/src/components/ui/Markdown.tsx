'use client';

import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatSourceDisplay, isIpHost, resolveSourceHref } from '@/lib/source-display';
import { cn } from '@/lib/cn';

function MarkdownAnchor({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return <span>{children}</span>;

  const childText = typeof children === 'string' ? children.trim() : '';
  const resolved = resolveSourceHref(href) ?? href;
  const strippedHref = href.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const looksLikeRawUrl =
    childText.length > 0 &&
    (childText === href ||
      childText === strippedHref ||
      childText === resolved ||
      /^https?:\/\//i.test(childText) ||
      isIpHost(childText.split('/')[0]?.split(':')[0] ?? ''));

  if (looksLikeRawUrl) {
    const { label, hint } = formatSourceDisplay(href);
    return (
      <a
        href={resolved}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent-blue)] hover:underline underline-offset-2"
        title={resolved}
      >
        {label}
        {hint ? <span className="text-muted"> · {hint}</span> : null}
      </a>
    );
  }

  return (
    <a
      href={resolved}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent-blue)] hover:underline underline-offset-2"
    >
      {children}
    </a>
  );
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('space-y-3 text-body text-foreground [&>*:first-child]:mt-0', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-body-lg font-semibold text-foreground mt-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-body-lg font-semibold text-foreground mt-4">{children}</h2>,
          h3: ({ children }) => <h3 className="font-semibold text-foreground mt-3">{children}</h3>,
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-muted">{children}</li>,
          a: ({ href, children }) => <MarkdownAnchor href={href}>{children}</MarkdownAnchor>,
          code: ({ children }) => (
            <code className="px-1 py-0.5 rounded bg-gtm-bg border border-gtm-border text-xs font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="text-xs font-mono bg-gtm-bg border border-gtm-border p-3 rounded overflow-x-auto">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gtm-accent/50 pl-3 text-muted italic">{children}</blockquote>
          ),
          hr: () => <hr className="border-gtm-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="text-left text-xs text-muted border-b border-gtm-border">{children}</thead>,
          th: ({ children }) => <th className="pb-2 pr-4 font-medium">{children}</th>,
          td: ({ children }) => <td className="py-2 pr-4 border-b border-gtm-border/50">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
