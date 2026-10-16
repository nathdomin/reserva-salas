import { Plus } from 'lucide-react';
import { NavLink } from 'react-router';
import type { Perfil } from '@reserva/shared';
import { cn } from '../../lib/cn';
import { ButtonLink } from '../ui/Button';
import { NAV_SECTIONS } from './nav-items';

/** Menu principal: o item ativo ganha fundo rosado e o ícone num quadrado vermelho. */
export function SideNav({
  perfil,
  onNavigate,
  contadores,
}: {
  perfil: Perfil;
  onNavigate?: () => void;
  /** Número pequeno ao lado de um item (ex.: reuniões futuras em "Minhas reservas"). */
  contadores?: Record<string, string | undefined>;
}) {
  const secoes = NAV_SECTIONS.filter((section) => !section.somenteAdmin || perfil === 'ADMIN');
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-5">
      <ButtonLink to="/reservas/nova" onClick={onNavigate} className="w-full">
        <Plus aria-hidden className="size-4" strokeWidth={2.5} />
        Nova reserva
      </ButtonLink>

      {secoes.map((section, index) => (
        <div key={section.label ?? index}>
          {section.label && (
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">
              {section.label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map(({ to, label, icon: Icon, end }) => {
              const contador = contadores?.[to];
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex h-10 items-center gap-3 rounded-lg px-2 text-md',
                        'transition-[background-color,color,transform] duration-150 ease-(--ease-suave)',
                        isActive
                          ? 'bg-brand-soft font-semibold text-ink'
                          : 'text-ink/75 hover:translate-x-0.5 hover:bg-canvas hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Ícone num quadradinho: vermelho com ícone branco no item ativo. */}
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-md transition-colors',
                            isActive
                              ? 'bg-brand-strong text-paper shadow-[0_2px_6px_rgb(200_0_8/0.3)]'
                              : 'bg-canvas text-ink/55 group-hover:bg-paper group-hover:text-ink',
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {contador && (
                          <span
                            aria-hidden
                            className={cn(
                              'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold',
                              isActive ? 'bg-brand-strong text-paper' : 'bg-ink/8 text-ink/70',
                            )}
                          >
                            {contador}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
