import { cn } from '@/lib/cn';

/** A rough search-result snippet so title/description length problems are visible before publishing. */
export function SerpPreview({ title, description, url, className }: { title: string; description: string; url?: string; className?: string }) {
  return (
    <div className={cn('rounded-[var(--radius-md)] border border-border bg-surface-elevated p-4', className)} aria-label="Search result preview">
      <p className="truncate text-[length:var(--fs-micro)] text-muted">{url || 'example.com'}</p>
      <p className="mt-1 line-clamp-1 text-[length:var(--fs-h3)] text-[var(--accent-blue)]">{title || 'Untitled page'}</p>
      <p className="mt-1 line-clamp-2 text-[length:var(--fs-small)] text-muted">{description || 'No description. Search engines will pick text from the page.'}</p>
    </div>
  );
}
