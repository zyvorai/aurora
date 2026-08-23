import { cn } from '@/lib/cn';

/** A single shimmering placeholder bar. Width/height are plain Tailwind sizing
 * classes so call sites can shape it to whatever text/element it stands in for. */
export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-[var(--radius-sm)] h-4', className)} aria-hidden />;
}

/** Placeholder shaped like a dashboard product Card (title + subtitle + two buttons). */
export function SkeletonCard() {
  return (
    <div className="glass rounded-[var(--radius-liquid)] p-5 space-y-4" aria-hidden>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <SkeletonLine className="w-1/2" />
          <SkeletonLine className="w-1/3 h-3" />
        </div>
        <SkeletonLine className="w-16 h-5 rounded-full" />
      </div>
      <div className="flex gap-2">
        <SkeletonLine className="h-9 flex-1 rounded-[var(--radius-md)]" />
        <SkeletonLine className="h-9 flex-1 rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}

/** Placeholder shaped like a Table -- a header row plus N body rows. */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="glass rounded-[var(--radius-liquid)] overflow-hidden" aria-hidden>
      <div className="flex gap-4 px-4 py-3 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4 px-4 py-3.5 border-b border-border last:border-0">
          {Array.from({ length: columns }).map((_, col) => (
            <SkeletonLine key={col} className={cn('flex-1', col === 0 ? 'w-1/3' : '')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder shaped like PageHero (icon badge + title + description). */
export function SkeletonHero() {
  return (
    <div className="tahoe-hero p-5 lg:p-6 space-y-3" aria-hidden>
      <div className="flex items-start gap-4">
        <SkeletonLine className="w-[3.25rem] h-[3.25rem] rounded-[var(--radius-liquid)] shrink-0" />
        <div className="space-y-2 flex-1 max-w-md pt-1">
          <SkeletonLine className="w-2/3 h-6" />
          <SkeletonLine className="w-full h-4" />
        </div>
      </div>
    </div>
  );
}

/** A handful of text-line placeholders, for text-heavy pages (e.g. an executive brief). */
export function SkeletonText({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={i === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  );
}
