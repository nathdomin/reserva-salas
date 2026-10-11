import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Área de conteúdo com fundo branco sobre o cinza da aplicação. */
export function Panel({ title, actions, children, className }: PanelProps) {
  return (
    <section className={cn('min-w-0 rounded-lg border border-line bg-paper', className)}>
      {title && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
