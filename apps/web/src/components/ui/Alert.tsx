import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface AlertProps {
  tone: 'error' | 'success';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone, title, children, action, className }: AlertProps) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-md border-l-4 bg-paper p-4',
        tone === 'error' ? 'border-brand' : 'border-ok',
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn('mt-0.5 size-5 shrink-0', tone === 'error' ? 'text-brand-strong' : 'text-ok')}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
