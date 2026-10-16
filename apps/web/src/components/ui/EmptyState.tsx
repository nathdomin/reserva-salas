import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Ilustração das telas vazias: um "cartão de agenda" em linha, com os mesmos blocos de
 * reserva do calendário, e o ícone do assunto num selo no canto. Um desenho só para
 * todas as telas, mudando o ícone.
 */
function Ilustracao({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden className="relative block h-20 w-28 animate-subir">
      <svg viewBox="0 0 112 80" className="absolute inset-0 size-full" fill="none">
        <rect x="1" y="6" width="96" height="70" rx="10" className="fill-paper stroke-line" />
        <path d="M1 22h96" className="stroke-line" />
        <circle cx="12" cy="14" r="2.5" className="fill-line" />
        <circle cx="20" cy="14" r="2.5" className="fill-line" />
        {/* Bloco de reserva (vermelho) e bloco ocupado (cinza), como no calendário. */}
        <rect x="12" y="30" width="52" height="14" rx="3" className="fill-brand-soft" />
        <rect x="12" y="30" width="3" height="14" rx="1.5" className="fill-brand" />
        <rect x="12" y="50" width="38" height="14" rx="3" className="fill-[#ececec]" />
        <rect x="12" y="50" width="3" height="14" rx="1.5" className="fill-ink/60" />
        <path
          d="M72 37h14M58 57h28"
          className="stroke-line"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute -right-1 -bottom-1 grid size-11 place-items-center rounded-full bg-paper shadow-card ring-1 ring-line">
        <Icon className="size-5 text-brand-strong" />
      </span>
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 py-6 sm:py-8">
      <Ilustracao icon={icon} />
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
