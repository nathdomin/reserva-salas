import { APP_LOCALE, APP_TIMEZONE } from '@reserva/shared';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { SkeletonLista } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import { dataDoInstante } from '../../lib/calendario';
import { formatHorario } from '../../lib/format';
import { errorMessage } from '../../lib/forms';
import { useMinhasReservas } from './api';

const fmtMes = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short', timeZone: APP_TIMEZONE });

/** Próximas reuniões de quem está logado (tela inicial), com a data num bloco à esquerda. */
export function ProximasReunioes({ hoje }: { hoje: string }) {
  const reservas = useMinhasReservas('proximas', 6);

  if (reservas.isPending)
    return <SkeletonLista label="Carregando suas reuniões" linhas={3} cartao={false} />;
  if (reservas.isError) return <Alert tone="error" title={errorMessage(reservas.error)} />;
  if (reservas.data.length === 0) {
    return <p className="py-2 text-sm text-muted">Suas próximas reuniões aparecem aqui.</p>;
  }

  const agora = Date.now();
  return (
    <ul className="-mx-2 flex flex-col gap-0.5" aria-label="Próximas reuniões">
      {reservas.data.map((r) => {
        const emAndamento = new Date(r.inicio).getTime() <= agora;
        const dia = dataDoInstante(r.inicio);
        const ehHoje = dia === hoje;
        return (
          <li key={r.id}>
            <Link
              to={`/reservas/${r.id}`}
              className="flex items-center gap-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-canvas"
            >
              <span
                aria-hidden
                className={cn(
                  'w-14 shrink-0 rounded-lg py-1.5 text-center',
                  ehHoje ? 'bg-brand-soft text-brand-strong' : 'bg-canvas',
                )}
              >
                <span className="block text-xl leading-none font-bold">{Number(dia.slice(8))}</span>
                <span className="mt-0.5 block text-[11px] tracking-wider uppercase">
                  {ehHoje ? 'hoje' : fmtMes.format(new Date(r.inicio)).replace('.', '')}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.motivo}</span>
                <span className="block truncate text-sm text-muted">
                  {r.sala.nome}, {r.sala.localizacao} ·{' '}
                  {r.diaInteiro ? 'Dia inteiro' : formatHorario(r.inicio, r.fim, false)}
                </span>
              </span>
              {emAndamento && <Badge tone="alert">Agora</Badge>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
