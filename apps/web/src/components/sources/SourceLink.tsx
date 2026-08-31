'use client';

import type { MouseEvent } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { formatSourceDisplay } from '@/lib/source-display';
import { cn } from '@/lib/cn';

interface SourceLinkProps {
  urlOrKey: string | null | undefined;
  /** header = under titles; inline = sources list; compact = tables & citations */
  variant?: 'header' | 'inline' | 'compact';
  className?: string;
  /** Stop row/card click handlers when the link is inside a clickable container */
  stopPropagation?: boolean;
}

export function SourceLink({
  urlOrKey,
  variant = 'inline',
  className,
  stopPropagation = false,
}: SourceLinkProps) {
  const { label, hint, href } = formatSourceDisplay(urlOrKey);
  if (!label) return null;

  const showIcons = variant !== 'compact';
  const rootClass = cn(
    'source-link',
    variant === 'header' && 'source-link--header',
    variant === 'compact' && 'source-link--compact',
    !href && 'source-link--static',
    className,
  );

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (stopPropagation) e.stopPropagation();
  }

  const content = (
    <>
      {showIcons ? <Globe className="source-link-icon" aria-hidden /> : null}
      <span className="source-link-label">{label}</span>
      {hint ? <span className="source-link-hint">· {hint}</span> : null}
      {showIcons && href ? <ExternalLink className="source-link-external" aria-hidden /> : null}
    </>
  );

  if (!href) {
    return <span className={rootClass}>{content}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={rootClass}
      title={href}
      onClick={onClick}
    >
      {content}
    </a>
  );
}
