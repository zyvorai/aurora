/**
 * zyvor.dev top-left brand: open orange "Z" stroke + lowercase "zyvor" wordmark.
 * Ported from fabric/web/src/components/ZyvorMark.tsx.
 */

export const ZYVOR_ACCENT = '#ff5a15';

export function ZyvorMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 18 18"
      width="22"
      height="22"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M2 2h14L6.6 16H16"
        fill="none"
        stroke={ZYVOR_ACCENT}
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Full navbar lockup as on https://zyvor.dev — orange Z + "zyvor". */
export function ZyvorLockup({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <ZyvorMark className={markClassName} />
      {showWordmark ? (
        <span
          className={wordmarkClassName}
          style={{
            fontWeight: 600,
            letterSpacing: '-0.02em',
            fontSize: '1.05em',
            lineHeight: 1,
          }}
        >
          zyvor
        </span>
      ) : null}
    </span>
  );
}
