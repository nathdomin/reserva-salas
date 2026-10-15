import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Esconde as ações abaixo de 1024px, quando a barra superior já oferece o mesmo atalho. */
  actionsOnlyOnDesktop?: boolean;
}

export function PageHeader({ title, description, actions, actionsOnlyOnDesktop }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
      </div>
      {actions && (
        <div className={cn('flex shrink-0 gap-2', actionsOnlyOnDesktop && 'hidden lg:flex')}>
          {actions}
        </div>
      )}
    </header>
  );
}
