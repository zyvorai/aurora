'use client';

import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  strong?: boolean;
  hover?: boolean;
}

export function Card({ children, className, elevated, strong, hover }: CardProps) {
  return (
    <div
      className={cn(
        'glass',
        elevated && 'glass-elevated',
        strong && 'glass-strong',
        hover && 'glass-hover-lift',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-3 border-b border-border', className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-3 border-t border-border', className)}>
      {children}
    </div>
  );
}
