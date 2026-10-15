import { somarDias, type Reserva } from '@reserva/shared';
import { CalendarClock, Clock, Plus } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { buttonClasses, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { dataDoInstante } from '../../lib/calendario';
import { formatDiaCurto, formatHora } from '../../lib/format';
import { errorMessage } from '../../lib/forms';
import { useMinhasReservas } from '../reservas/api';

/** "começa em 25 min", "começa em 2 h 10 min", "amanhã", "termina às 15:30" (já começou)… */
function quando(r: Reserva, agora: Date, hoje: string): string {
  const inicio = new Date(r.inicio);
  if (inicio <= agora) return `termina às ${formatHora(r.fim)}`;
  const dia = dataDoInstante(r.inicio);
  if (dia === hoje) {
    const min = Math.max(1, Math.round((inicio.getTime() - agora.getTime()) / 60_000));
    if (min < 60) return `começa em ${min} min`;
    const h = Math.floor(min / 60);
    const resto = min % 60;
    return `começa em ${h} h${resto ? ` ${resto} min` : ''}`;
  }
  if (dia === somarDias(hoje, 1)) return 'amanhã';
  return formatDiaCurto(r.inicio);
}

/** Destaque vermelho da tela inicial: a próxima reunião de quem está logado. */
export function ProximaReuniao({ agora, hoje }: { agora: Date; hoje: string }) {
  const reservas = useMinhasReservas('proximas', 6);

  if (reservas.isPending) {
    return (
      <div role="status" className="rounded-xl border border-line bg-paper p-6 shadow-card">
        <span className="sr-only">Carregando sua próxima reunião…</span>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-4 h-10 w-36" />
        <Skeleton className="mt-3 h-4 w-56" />
        <Skeleton className="mt-2 h-3 w-44" />
      </div>
    );
  }
  if (reservas.isError) return <Alert tone="error" title={errorMessage(reservas.error)} />;

  const r = reservas.data[0];
  if (!r) {
    return (
      <div className="rounded-xl border border-line bg-paper px-6 shadow-card">
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma reunião agendada"
          description="Sua próxima reunião aparece aqui em destaque assim que for reservada."
          action={
            <ButtonLink to="/reservas/nova" variant="secondary" size="sm">
              <Plus aria-hidden className="size-4" />
              Reservar uma sala
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const acontecendo = new Date(r.inicio) <= agora;
  return (
    <article
      aria-labelledby="proxima-reuniao"
      className="relative overflow-hidden rounded-xl bg-[linear-gradient(135deg,var(--color-brand)_0%,var(--color-brand-strong)_70%)] p-6 text-paper shadow-[0_8px_24px_rgb(200_0_8/0.25)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-44 rounded-full bg-paper/8"
      />
      <h2
        id="proxima-reuniao"
        className="text-xs font-semibold tracking-wider text-paper/90 uppercase"
      >
        {acontecendo ? 'Acontecendo agora' : 'Sua próxima reunião'}
      </h2>
      <p className="mt-3 text-5xl leading-none font-bold tracking-tight">
        {r.diaInteiro ? (
          'Dia inteiro'
        ) : (
          <>
            {formatHora(r.inicio)}{' '}
            <span className="text-lg font-medium text-paper/90">às {formatHora(r.fim)}</span>
          </>
        )}
      </p>
      <p className="mt-3 text-lg font-semibold">{r.motivo}</p>
      <p className="text-sm text-paper/90">
        {r.sala.nome}, {r.sala.localizacao}
        {r.participantes ? ` · ${r.participantes} participantes` : ''}
      </p>
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink/20 px-3 py-1 text-sm font-semibold">
        <Clock aria-hidden className="size-3.5" />
        {quando(r, agora, hoje)}
      </p>
      <div className="relative mt-5 flex flex-wrap gap-2">
        <Link
          to={`/reservas/${r.id}`}
          className={cn(
            buttonClasses('secondary', 'sm'),
            'border-transparent text-brand-strong hover:border-transparent hover:bg-brand-soft',
          )}
        >
          Ver detalhes
        </Link>
        {r.podeEditar && (
          <Link
            to={`/reservas/${r.id}/editar`}
            className={cn(buttonClasses('ghost', 'sm'), 'bg-paper/15 text-paper hover:bg-paper/25')}
          >
            Editar
          </Link>
        )}
      </div>
    </article>
  );
}
