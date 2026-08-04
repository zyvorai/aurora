import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TypographyProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  id?: string;
};

export function Eyebrow({ children, className, as: Tag = 'p', id }: TypographyProps) {
  return <Tag id={id} className={cn('text-eyebrow', className)}>{children}</Tag>;
}

export function DisplayTitle({ children, className, as: Tag = 'h1', id }: TypographyProps) {
  return (
    <Tag
      id={id}
      className={cn(
        'text-display md:text-[3rem] font-bold tracking-tight leading-tight',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function PageTitle({ children, className, as: Tag = 'h1', id }: TypographyProps) {
  return (
    <Tag
      id={id}
      className={cn(
        'text-page-title md:text-[2.25rem] font-bold tracking-tight leading-tight',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, className, as: Tag = 'h2', id }: TypographyProps) {
  return (
    <Tag id={id} className={cn('text-title font-semibold text-foreground', className)}>
      {children}
    </Tag>
  );
}

export function SubsectionTitle({ children, className, as: Tag = 'h3', id }: TypographyProps) {
  return (
    <Tag id={id} className={cn('text-body-lg font-semibold text-foreground', className)}>
      {children}
    </Tag>
  );
}

export function Text({ children, className, as: Tag = 'p' }: TypographyProps) {
  return <Tag className={cn('text-body text-foreground', className)}>{children}</Tag>;
}

export function TextMuted({ children, className, as: Tag = 'p' }: TypographyProps) {
  return <Tag className={cn('text-body text-muted', className)}>{children}</Tag>;
}

export function TextSmall({ children, className, as: Tag = 'p' }: TypographyProps) {
  return <Tag className={cn('text-body-sm text-muted', className)}>{children}</Tag>;
}

export function TextLead({ children, className, as: Tag = 'p' }: TypographyProps) {
  return <Tag className={cn('text-body-lg text-muted leading-relaxed', className)}>{children}</Tag>;
}

interface StatProps {
  label: string;
  value: string | number;
  className?: string;
  highlight?: boolean;
}

export function Stat({ label, value, className, highlight }: StatProps) {
  return (
    <div className={className}>
      <p className="text-stat-label">{label}</p>
      <p className={cn('text-stat-value mt-1', highlight && 'text-primary')}>{value}</p>
    </div>
  );
}
