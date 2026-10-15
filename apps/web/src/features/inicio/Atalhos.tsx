import { CalendarDays, ClipboardList, Plus, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

const ATALHOS: { to: string; rotulo: string; icon: LucideIcon }[] = [
  { to: '/reservas/nova', rotulo: 'Nova reserva', icon: Plus },
  { to: '/calendario', rotulo: 'Calendário', icon: CalendarDays },
  { to: '/minhas-reservas', rotulo: 'Minhas reservas', icon: ClipboardList },
];

/** Atalhos da tela inicial: cartões que "sobem" levemente ao passar o mouse. */
export function Atalhos() {
  return (
    <nav aria-label="Atalhos" className="grid grid-cols-3 gap-3 sm:max-w-2xl">
      {ATALHOS.map(({ to, rotulo, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="group flex flex-col items-start gap-3 rounded-xl border border-line bg-paper p-4 text-sm font-semibold shadow-card transition-[box-shadow,transform,border-color] duration-200 ease-(--ease-suave) hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-raised"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand-strong transition-transform duration-200 ease-(--ease-suave) group-hover:scale-110 group-hover:-rotate-6">
            <Icon aria-hidden className="size-[18px]" />
          </span>
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}
