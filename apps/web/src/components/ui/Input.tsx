'use client';

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const fieldClass =
  'w-full h-10 px-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] ' +
  'text-[15px] leading-tight text-foreground placeholder:text-muted ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-background';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldClass, className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[5rem] px-3.5 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-[10px]',
        'text-[15px] leading-snug text-foreground placeholder:text-muted resize-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
