import { STATUS_RESERVA_LABEL, type Reserva } from '@reserva/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { formatDiaCurto, formatHorario } from '../../lib/format';
import { CancelarReserva } from './CancelarReserva';

interface ListaReservasProps {
  reservas: Reserva[];
  rotulo: string;
  /** Mostra a coluna "Responsável" (painel do administrador). */
  mostrarResponsavel?: boolean;
  usuarioId: string | undefined;
  onCancelada?: (reserva: Reserva) => void;
}

/**
 * Lista de reservas com data, horário, sala, motivo e situação, e as ações permitidas.
 * Em telas largas fica em colunas; no celular, cada reserva vira um cartão.
 */
export function ListaReservas({
  reservas,
  rotulo,
  mostrarResponsavel = false,
  usuarioId,
  onCancelada,
}: ListaReservasProps) {
  const [cancelando, setCancelando] = useState<string | null>(null);

  const colunas = mostrarResponsavel
    ? 'xl:grid-cols-[8.5rem_8.5rem_minmax(0,1fr)_9rem_5.5rem_10rem]'
    : 'xl:grid-cols-[8.5rem_9rem_minmax(0,1fr)_5.5rem_10rem]';

  return (
    <div className="rounded-lg border border-line bg-paper">
      <div
        aria-hidden
        className={cn(
          'hidden gap-4 border-b border-line px-5 py-2 text-xs font-medium text-muted xl:grid',
          colunas,
        )}
      >
        <span>Data e horário</span>
        <span>Sala</span>
        <span>Motivo</span>
        {mostrarResponsavel && <span>Responsável</span>}
        <span>Situação</span>
        <span className="sr-only">Ações</span>
      </div>
      <ul aria-label={rotulo} className="divide-y divide-line">
        {reservas.map((r) => {
          const cancelada = r.status === 'CANCELADA';
          return (
            <li key={r.id} className="px-5 py-3">
              <div className={cn('grid gap-x-4 gap-y-1 xl:items-center', colunas)}>
                <div>
                  <p className="font-semibold">{formatDiaCurto(r.inicio)}</p>
                  <p className="text-sm text-muted">
                    {r.diaInteiro ? 'Dia inteiro' : formatHorario(r.inicio, r.fim, false)}
                  </p>
                </div>
                <p className="text-sm">
                  {r.sala.nome}
                  <span className="text-muted xl:hidden">, </span>
                  <span className="text-muted xl:block">{r.sala.localizacao}</span>
                </p>
                <p className={cn('min-w-0 break-words', cancelada && 'text-muted')}>
                  <Link
                    to={`/reservas/${r.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                    title="Ver detalhes"
                  >
                    {r.motivo}
                  </Link>
                  {cancelada && r.motivoCancelamento && (
                    <span className="block text-sm">Cancelada: {r.motivoCancelamento}</span>
                  )}
                </p>
                {mostrarResponsavel && <p className="text-sm">{r.responsavel.nome}</p>}
                <div>
                  <Badge tone={cancelada ? 'muted' : 'strong'}>
                    {STATUS_RESERVA_LABEL[r.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 xl:justify-end">
                  {r.podeEditar && (
                    <ButtonLink
                      to={`/reservas/${r.id}/editar`}
                      variant="ghost"
                      size="sm"
                      aria-label={`Editar: ${r.motivo}, ${formatDiaCurto(r.inicio)}`}
                    >
                      Editar
                    </ButtonLink>
                  )}
                  {r.podeCancelar && cancelando !== r.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Cancelar: ${r.motivo}, ${formatDiaCurto(r.inicio)}`}
                      onClick={() => setCancelando(r.id)}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
              {r.podeCancelar && cancelando === r.id && (
                <CancelarReserva
                  reserva={r}
                  deOutraPessoa={r.responsavel.id !== usuarioId}
                  className="mt-3 rounded-md bg-canvas p-4"
                  onCancelada={(atualizada) => {
                    setCancelando(null);
                    onCancelada?.(atualizada);
                  }}
                  onVoltar={() => setCancelando(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
