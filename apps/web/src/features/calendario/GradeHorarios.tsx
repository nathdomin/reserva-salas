import {
  emMinutos,
  gerarHorarios,
  paraHora,
  paraInstante,
  type Configuracoes,
  type Reserva,
} from '@reserva/shared';
import { useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { diaCurto, distribuirEmColunas, minutosDoInstante } from '../../lib/calendario';
import { formatHora, formatHorario } from '../../lib/format';
import { ESTILO_MINHA, ESTILO_OCUPADO, ESTILO_PASSADO } from './estilos';

/** Altura de 1 hora na grade, em pixels: maior em tela de toque, para o dedo acertar o horário. */
const HORA_PX = 48;
const HORA_PX_TOQUE = 64;
/** Altura de uma linha de texto dentro de uma reserva (text-xs com leading-tight). */
const LINHA_PX = 15;

const TOQUE = '(pointer: coarse)';

function assinarToque(aviso: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(TOQUE);
  media.addEventListener('change', aviso);
  return () => media.removeEventListener('change', aviso);
}

/** A tela é de toque (celular, tablet)? */
function useTelaDeToque() {
  return useSyncExternalStore(
    assinarToque,
    () => typeof window.matchMedia === 'function' && window.matchMedia(TOQUE).matches,
    () => false,
  );
}

export interface ColunaGrade {
  chave: string;
  titulo: ReactNode;
  data: string;
  /** Sala da coluna (visão do dia por sala). Sem sala, o formulário pede para escolher. */
  sala?: { id: string; nome: string } | undefined;
  reservas: Reserva[];
  destaque?: boolean;
}

interface GradeHorariosProps {
  colunas: ColunaGrade[];
  config: Configuracoes;
  agora: Date;
  usuarioId: string | undefined;
  /** Mostra o nome da sala em cada reserva (quando a coluna não é de uma sala só). */
  mostrarSala: boolean;
  /** Sala selecionada no filtro: vai junto ao clicar num horário livre. */
  salaFiltro?: string | undefined;
  /** Largura mínima de cada coluna, em pixels (abaixo disso a grade rola para o lado). */
  larguraColuna?: number;
}

/**
 * Grade de horários (visões semanal e diária): uma coluna por dia ou por sala,
 * reservas posicionadas pelo horário e horários livres clicáveis para reservar.
 */
export function GradeHorarios({
  colunas,
  config,
  agora,
  usuarioId,
  mostrarSala,
  salaFiltro,
  larguraColuna = 120,
}: GradeHorariosProps) {
  const horaPx = useTelaDeToque() ? HORA_PX_TOQUE : HORA_PX;
  const abertura = emMinutos(config.horarioInicio);
  const fechamento = emMinutos(config.horarioFim);
  const totalMin = Math.max(fechamento - abertura, 60);
  const altura = (totalMin / 60) * horaPx;
  const px = (minutos: number) => ((minutos - abertura) / 60) * horaPx;
  // Horários clicáveis a cada 30 min (ou na granularidade, se for maior).
  const passo = Math.max(config.granularidadeMinutos, 30);
  const horasCheias = gerarHorarios(config.horarioInicio, config.horarioFim, 60).filter(
    (h) => emMinutos(h) < fechamento,
  );
  const inicios: number[] = [];
  for (let t = abertura; t + config.granularidadeMinutos <= fechamento; t += passo) inicios.push(t);

  return (
    // Rolagem própria (limitada à altura da tela) para o cabeçalho ficar fixo no topo da grade.
    <div className="max-h-[calc(100dvh-7rem)] overflow-auto overscroll-contain rounded-lg border border-line bg-paper">
      <div style={{ minWidth: 56 + colunas.length * larguraColuna }}>
        {/* Cabeçalho */}
        <div className="sticky top-0 z-40 flex border-b border-line bg-paper">
          <div className="sticky left-0 z-30 w-14 shrink-0 bg-paper" />
          {colunas.map((c) => (
            <div
              key={c.chave}
              className={cn(
                'min-w-0 flex-1 border-l border-line px-1 py-2 text-center text-sm',
                c.destaque && 'bg-brand-soft',
              )}
            >
              {c.titulo}
            </div>
          ))}
        </div>

        {/* Corpo */}
        <div className="flex">
          <div
            className="sticky left-0 z-30 w-14 shrink-0 bg-paper"
            style={{ height: altura }}
            aria-hidden
          >
            {horasCheias.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-xs text-muted first:translate-y-0"
                style={{ top: px(emMinutos(h)) }}
              >
                {h}
              </span>
            ))}
          </div>

          {colunas.map((coluna) => {
            const fimDoDia = paraInstante(coluna.data, config.horarioFim);
            const inicioDoDia = paraInstante(coluna.data, config.horarioInicio);
            // Parte do dia que já passou (sombreada).
            const passadoAte =
              agora >= fimDoDia
                ? fechamento
                : agora <= inicioDoDia
                  ? abertura
                  : Math.min(
                      fechamento,
                      abertura + (agora.getTime() - inicioDoDia.getTime()) / 60_000,
                    );

            const posicionadas = distribuirEmColunas(
              coluna.reservas,
              (r) => Math.max(minutosDoInstante(r.inicio), abertura),
              (r) => Math.min(minutosDoInstante(r.fim), fechamento),
            );

            return (
              <div
                key={coluna.chave}
                className="relative min-w-0 flex-1 border-l border-line"
                style={{ height: altura }}
              >
                {/* Linhas das horas */}
                {horasCheias.map((h) => (
                  <div
                    key={h}
                    aria-hidden
                    className="absolute inset-x-0 border-t border-line/70"
                    style={{ top: px(emMinutos(h)) }}
                  />
                ))}

                {passadoAte > abertura && (
                  <div
                    aria-hidden
                    className={cn('absolute inset-x-0 top-0', ESTILO_PASSADO)}
                    style={{ height: px(passadoAte) }}
                  />
                )}

                {/* Horários livres: links para reservar */}
                {inicios
                  .filter((t) => paraInstante(coluna.data, paraHora(t)) > agora)
                  // Numa coluna de uma sala só, horário já ocupado não vira link.
                  .filter(
                    (t) =>
                      !(coluna.sala || salaFiltro) ||
                      !coluna.reservas.some(
                        (r) => minutosDoInstante(r.inicio) <= t && t < minutosDoInstante(r.fim),
                      ),
                  )
                  .map((t) => {
                    const hora = paraHora(t);
                    const salaId = coluna.sala?.id ?? salaFiltro;
                    const params = new URLSearchParams({ data: coluna.data, inicio: hora });
                    if (salaId) params.set('salaId', salaId);
                    return (
                      <Link
                        key={t}
                        to={`/reservas/nova?${params.toString()}`}
                        aria-label={`Reservar ${diaCurto(coluna.data)} às ${hora}${
                          coluna.sala ? `, ${coluna.sala.nome}` : ''
                        }`}
                        className="group absolute inset-x-0 block hover:bg-canvas focus-visible:z-20"
                        style={{
                          top: px(t),
                          height: (Math.min(passo, fechamento - t) / 60) * horaPx,
                        }}
                      >
                        <span className="hidden px-1.5 pt-0.5 text-xs font-medium text-muted group-hover:block group-focus-visible:block">
                          + {hora}
                        </span>
                      </Link>
                    );
                  })}

                {/* Reservas */}
                {posicionadas.map(({ item: r, coluna: col, colunas: cols }) => {
                  const ini = Math.max(minutosDoInstante(r.inicio), abertura);
                  const fim = Math.min(minutosDoInstante(r.fim), fechamento);
                  const minha = r.responsavel.id === usuarioId;
                  const horario = formatHorario(r.inicio, r.fim, false);
                  const descricao = [
                    horario,
                    mostrarSala ? r.sala.nome : null,
                    r.motivo,
                    r.responsavel.nome,
                    minha ? 'sua reserva' : null,
                  ]
                    .filter(Boolean)
                    .join(', ');
                  const alturaBloco = Math.max(px(fim) - px(ini), 20);
                  // Só as linhas que cabem inteiras; sem espaço para duas, tudo vai numa só.
                  const cabem = Math.floor((alturaBloco - 6) / LINHA_PX);
                  const linhas = [
                    mostrarSala ? r.sala.nome : null,
                    r.motivo,
                    r.responsavel.nome,
                  ].filter((l): l is string => Boolean(l));
                  return (
                    <Link
                      key={r.id}
                      to={`/reservas/${r.id}`}
                      aria-label={descricao}
                      title={descricao}
                      className={cn(
                        'absolute z-10 overflow-hidden rounded-sm px-1 text-xs leading-tight',
                        cabem >= 2 ? 'py-0.5' : 'flex items-center',
                        'hover:shadow-[0_1px_4px_rgba(0,0,0,0.18)]',
                        minha ? ESTILO_MINHA : ESTILO_OCUPADO,
                      )}
                      style={{
                        top: px(ini) + 1,
                        height: alturaBloco - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                      }}
                    >
                      {cabem >= 2 ? (
                        <>
                          <span className="block truncate font-semibold">
                            {formatHora(r.inicio)}–{formatHora(r.fim)}
                          </span>
                          {linhas.slice(0, cabem - 1).map((linha, i) => (
                            <span
                              key={i}
                              className={cn(
                                'block truncate',
                                i === linhas.length - 1 && 'text-muted',
                              )}
                            >
                              {linha}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="block truncate">
                          <span className="font-semibold">{formatHora(r.inicio)}</span>{' '}
                          {linhas.slice(0, -1).join(' · ')}
                        </span>
                      )}
                    </Link>
                  );
                })}

                {/* Linha do horário atual */}
                {passadoAte > abertura && passadoAte < fechamento && (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 z-[5] border-t-2 border-brand"
                    style={{ top: px(passadoAte) }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
