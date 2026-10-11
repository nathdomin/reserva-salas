import type { Reserva } from '@reserva/shared';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { dataDoInstante, gradeDoMes, nomeCurtoDoDia } from '../../lib/calendario';
import { formatHora } from '../../lib/format';
import { ESTILO_MINHA, ESTILO_OCUPADO } from './estilos';

const MAX_POR_DIA = 3;

interface CalendarioMesProps {
  data: string;
  hoje: string;
  reservas: Reserva[];
  usuarioId: string | undefined;
  mostrarSala: boolean;
  /** Link para a visão do dia (mantém os filtros atuais). */
  linkDoDia: (data: string) => string;
}

const fmtDia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function CalendarioMes({
  data,
  hoje,
  reservas,
  usuarioId,
  mostrarSala,
  linkDoDia,
}: CalendarioMesProps) {
  const semanas = gradeDoMes(data);
  const mes = data.slice(0, 7);
  const porDia = new Map<string, Reserva[]>();
  for (const r of reservas) {
    const dia = dataDoInstante(r.inicio);
    porDia.set(dia, [...(porDia.get(dia) ?? []), r]);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper">
      <div className="grid grid-cols-7 border-b border-line" aria-hidden>
        {semanas[0]!.map((dia) => (
          <div key={dia} className="px-2 py-2 text-center text-xs font-medium text-muted">
            {nomeCurtoDoDia(dia)}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7" aria-label="Dias do mês">
        {semanas.flat().map((dia) => {
          const doMes = dia.slice(0, 7) === mes;
          const passado = dia < hoje;
          const doDia = porDia.get(dia) ?? [];
          const nomeDia = fmtDia.format(new Date(`${dia}T12:00:00Z`));
          const resumo =
            doDia.length === 0
              ? 'sem reservas'
              : `${doDia.length} reserva${doDia.length > 1 ? 's' : ''}`;
          return (
            <li
              key={dia}
              className={cn(
                'flex min-h-16 flex-col gap-1 border-b border-l border-line p-1 sm:min-h-28 sm:p-1.5',
                '[&:nth-child(7n+1)]:border-l-0',
                !doMes && 'bg-canvas',
              )}
            >
              <Link
                to={linkDoDia(dia)}
                aria-label={`${nomeDia}: ${resumo}`}
                className={cn(
                  'grid size-7 place-items-center rounded-full text-sm hover:bg-canvas',
                  dia === hoje && 'bg-brand font-semibold text-paper hover:bg-brand-strong',
                  dia !== hoje && (!doMes || passado) && 'text-muted',
                )}
              >
                {Number(dia.slice(8))}
              </Link>

              {/* Celular: só a quantidade */}
              {doDia.length > 0 && (
                <Link
                  to={linkDoDia(dia)}
                  aria-hidden
                  tabIndex={-1}
                  className="rounded-sm bg-[#e9e9e9] px-1 text-center text-xs font-medium sm:hidden"
                >
                  {doDia.length}
                </Link>
              )}

              {/* Computador: as primeiras reuniões do dia */}
              <ul className="hidden flex-col gap-0.5 sm:flex">
                {doDia.slice(0, MAX_POR_DIA).map((r) => {
                  const minha = r.responsavel.id === usuarioId;
                  const texto = `${r.diaInteiro ? 'Dia todo' : formatHora(r.inicio)} ${
                    mostrarSala ? r.sala.nome : r.motivo
                  }`;
                  return (
                    <li key={r.id}>
                      <Link
                        to={`/reservas/${r.id}`}
                        title={`${texto}, ${r.motivo}, ${r.responsavel.nome}`}
                        className={cn(
                          'block truncate rounded-sm px-1 py-0.5 text-xs leading-tight',
                          minha ? ESTILO_MINHA : ESTILO_OCUPADO,
                          'border-l-2',
                        )}
                      >
                        {texto}
                      </Link>
                    </li>
                  );
                })}
                {doDia.length > MAX_POR_DIA && (
                  <li>
                    <Link
                      to={linkDoDia(dia)}
                      className="block px-1 text-xs font-medium text-muted hover:text-ink"
                    >
                      + {doDia.length - MAX_POR_DIA} mais
                    </Link>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
