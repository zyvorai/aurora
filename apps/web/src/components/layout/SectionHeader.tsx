import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow, SectionTitle, TextSmall } from '@/components/ui/Typography';

interface SectionHeaderProps {
  label?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ label, title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-4', className)}>
      <div>
        {label && <Eyebrow className="mb-1">{label}</Eyebrow>}
        <SectionTitle>{title}</SectionTitle>
        {description && <TextSmall className="mt-1">{description}</TextSmall>}
      </div>
      {action}
    </div>
  );
}
