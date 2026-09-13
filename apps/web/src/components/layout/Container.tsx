import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** 'app' (88rem) for app/portal/product-console content; 'marketing' (1180px) for the marketing site's nav/footer/sections. */
  tier?: 'app' | 'marketing';
}

export function Container({ children, className, as: Tag = 'div', tier = 'app' }: ContainerProps) {
  return (
    <Tag
      className={cn(
        'mx-auto px-[var(--hs-gutter)]',
        tier === 'app' ? 'max-w-container-app' : 'max-w-container-marketing',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
