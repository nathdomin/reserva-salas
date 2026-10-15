import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'strong' | 'muted' | 'alert' | 'warn';

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink',
  strong: 'bg-ink text-paper',
  muted: 'bg-canvas text-muted line-through decoration-muted/60',
  alert: 'bg-brand-soft text-brand-strong',
  warn: 'bg-warn-soft text-warn',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded px-2 text-xs font-medium whitespace-nowrap',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
