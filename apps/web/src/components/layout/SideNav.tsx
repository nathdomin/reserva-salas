import { Plus } from 'lucide-react';
import { NavLink } from 'react-router';
import type { Perfil } from '@reserva/shared';
import { cn } from '../../lib/cn';
import { ButtonLink } from '../ui/Button';
import { NAV_SECTIONS } from './nav-items';

/**
 * O item ativo é desenhado como um "bloco de reserva" vermelho — o mesmo elemento
 * que representará reservas no calendário.
 */
export function SideNav({ perfil, onNavigate }: { perfil: Perfil; onNavigate?: () => void }) {
  const secoes = NAV_SECTIONS.filter((section) => !section.somenteAdmin || perfil === 'ADMIN');
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-6">
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
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'relative flex h-10 items-center gap-3 rounded-md px-3 text-md transition-colors',
                      isActive
                        ? 'bg-brand-soft font-semibold text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-brand'
                        : 'text-ink/75 hover:bg-canvas hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        aria-hidden
                        className={cn('size-[18px]', isActive ? 'text-brand' : 'text-ink/50')}
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
