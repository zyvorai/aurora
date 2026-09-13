'use client';

import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { cn } from '@/lib/cn';

export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(!visible && 'opacity-0', visible && 'animate-fade-up', className)}>
      {children}
    </div>
  );
}

const MAX_STAGGER = 6;

/**
 * Like Reveal, but staggers each direct child's entrance individually
 * (reusing the existing .stagger-1..6 delay classes) instead of fading the
 * whole block in as one unit. Children beyond the 6th share stagger-6's delay.
 */
export function RevealGroup({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} id={id} className={className}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<{ className?: string }>;
        const stagger = `stagger-${Math.min(index + 1, MAX_STAGGER)}`;
        return cloneElement(el, {
          className: cn(el.props.className, !visible && 'opacity-0', visible && 'animate-fade-up', visible && stagger),
        });
      })}
    </div>
  );
}
