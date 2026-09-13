'use client';

import { cn } from '@/lib/cn';
import type { CSSProperties, ElementType, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  strong?: boolean;
  hover?: boolean;
  /** Colored 3px top bar — pass a CSS color via `style={{ '--card-accent': ... }}` to customize it. */
  accent?: boolean;
  /** Denser radius/spacing for information-dense surfaces (workspace panels, tables). */
  density?: 'default' | 'compact';
  as?: ElementType;
  style?: CSSProperties;
}

export function Card({
  children,
  className,
  elevated,
  strong,
  hover,
  accent,
  density = 'default',
  as: Tag = 'div',
  style,
}: CardProps) {
  return (
    <Tag
      className={cn(
        'glass',
        elevated && 'glass-elevated',
        strong && 'glass-strong',
        hover && 'glass-hover-lift',
        accent && 'card-accent-bar',
        density === 'compact' && 'card-compact',
        className,
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-3.5 border-b border-border', className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-3.5 border-t border-border', className)}>
      {children}
    </div>
  );
}
