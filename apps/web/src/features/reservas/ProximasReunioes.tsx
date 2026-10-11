import { CalendarClock, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { formatDiaCurto, formatHorario } from '../../lib/format';
import { errorMessage } from '../../lib/forms';
import { useMinhasReservas } from './api';

/** Próximas reuniões de quem está logado (tela inicial). */
export function ProximasReunioes() {
  const reservas = useMinhasReservas('proximas', 6);

  if (reservas.isPending) return <Spinner label="Carregando suas reuniões" />;
  if (reservas.isError) return <Alert tone="error" title={errorMessage(reservas.error)} />;

  if (reservas.data.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nenhuma reunião agendada"
        description="Suas próximas reuniões aparecem aqui, em ordem de horário, assim que forem reservadas."
        action={
          <ButtonLink to="/reservas/nova" variant="secondary" size="sm">
            <Plus aria-hidden className="size-4" />
            Reservar uma sala
          </ButtonLink>
        }
      />
    );
  }

  const agora = Date.now();
  return (
    <>
      <ul className="divide-y divide-line" aria-label="Próximas reuniões">
        {reservas.data.map((r) => {
          const emAndamento = new Date(r.inicio).getTime() <= agora;
          return (
            <li key={r.id}>
              <Link
                to={`/reservas/${r.id}`}
                className="-mx-2 flex items-start gap-4 rounded-md px-2 py-3 hover:bg-canvas"
              >
                <div className="w-24 shrink-0">
                  <p className="text-sm font-semibold">{formatDiaCurto(r.inicio)}</p>
                  <p className="text-sm text-muted">
                    {r.diaInteiro ? 'Dia inteiro' : formatHorario(r.inicio, r.fim, false)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.motivo}</p>
                  <p className="truncate text-sm text-muted">
                    {r.sala.nome}, {r.sala.localizacao}
                  </p>
                </div>
                {emAndamento && <Badge tone="alert">Agora</Badge>}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-sm font-medium">
        <Link to="/minhas-reservas" className="hover:underline">
          Ver todas as minhas reservas
        </Link>
        <Link to="/calendario" className="hover:underline">
          Abrir o calendário
        </Link>
      </div>
    </>
  );
}
