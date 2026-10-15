import {
  dataValida,
  hojeNoFuso,
  type Configuracoes,
  type Reserva,
  type Sala,
} from '@reserva/shared';
import { ChevronLeft, ChevronRight, DoorOpen, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { Spinner } from '../components/ui/Spinner';
import { useSessao } from '../features/auth/session';
import { AgendaDia } from '../features/calendario/AgendaDia';
import { CalendarioMes } from '../features/calendario/CalendarioMes';
import { GradeHorarios, type ColunaGrade } from '../features/calendario/GradeHorarios';
import { Legenda } from '../features/calendario/Legenda';
import { useConfiguracoes, useReservasPeriodo } from '../features/reservas/api';
import { useSalas } from '../features/salas/api';
import {
  dataDoInstante,
  diaCurto,
  diasDaSemana,
  navegar,
  periodoDaVisao,
  tituloDoPeriodo,
  VISOES,
  type Visao,
} from '../lib/calendario';
import { cn } from '../lib/cn';
import { errorMessage } from '../lib/forms';

function ehCelular() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches;
}

/** Sem visão na URL: semana no computador; agenda no celular (lista, sem rolagem lateral). */
function lerVisao(valor: string | null): Visao {
  if (VISOES.some((v) => v.valor === valor)) return valor as Visao;
  return ehCelular() ? 'agenda' : 'semana';
}

export function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const hoje = hojeNoFuso();
  const visao = lerVisao(params.get('visao'));
  const dataParam = params.get('data');
  const data = dataParam && dataValida(dataParam) ? dataParam : hoje;
  const salaId = params.get('sala') ?? '';

  const { data: usuario } = useSessao();
  const config = useConfiguracoes();
  const salas = useSalas(false);
  const periodo = periodoDaVisao(visao, data);
  const reservas = useReservasPeriodo(
    { dataInicio: periodo.inicio, dataFim: periodo.fim, salaId: salaId || undefined },
    { manterAnterior: true },
  );

  type Mudancas = { visao?: Visao; data?: string; sala?: string };

  /** Parâmetros do calendário mantendo o que não foi alterado (a URL guarda o estado). */
  function montar(mudancas: Mudancas) {
    const p = new URLSearchParams();
    p.set('visao', mudancas.visao ?? visao);
    p.set('data', mudancas.data ?? data);
    const sala = mudancas.sala ?? salaId;
    if (sala) p.set('sala', sala);
    return p;
  }

  const link = (mudancas: Mudancas) => `/calendario?${montar(mudancas).toString()}`;
  const ir = (mudancas: Mudancas) => setParams(montar(mudancas));

  // A semana mostra uma sala por vez: sem sala escolhida, abre na primeira.
  const salaEfetiva = visao === 'semana' && !salaId ? (salas.data?.[0]?.id ?? '') : salaId;
  const salaSelecionada = salas.data?.find((s) => s.id === salaEfetiva);
  const novaReservaHref = `/reservas/nova?${new URLSearchParams({
    data: data < hoje ? hoje : data,
    ...(salaEfetiva ? { salaId: salaEfetiva } : {}),
  }).toString()}`;

  const lista = (reservas.data ?? []).filter((r) => !salaEfetiva || r.sala.id === salaEfetiva);
  // A Agenda busca a semana (para a faixa de dias), mas a contagem é a do dia escolhido.
  const contagem =
    visao === 'agenda'
      ? lista.filter((r) => dataDoInstante(r.inicio) === data).length
      : lista.length;
  const periodoTexto = visao === 'agenda' ? 'neste dia' : 'neste período';

  return (
    <>
      <PageHeader
        title="Calendário"
        description="Horários livres e ocupados de cada sala. Toque ou clique em um horário livre para reservar."
        actionsOnlyOnDesktop
        actions={
          <ButtonLink to={novaReservaHref}>
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
            Nova reserva
          </ButtonLink>
        }
      />

      {/* Controles */}
      {/* Sem espaço numa linha, o grupo da direita desce inteiro (o título nunca é espremido). */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Button variant="secondary" size="sm" onClick={() => ir({ data: hoje })}>
            Hoje
          </Button>
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Período anterior"
              onClick={() => ir({ data: navegar(visao, data, -1) })}
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Próximo período"
              onClick={() => ir({ data: navegar(visao, data, 1) })}
            >
              <ChevronRight aria-hidden className="size-5" />
            </Button>
          </div>
          {/* No celular o título vem primeiro, numa linha só dele. */}
          <h2
            className="order-first w-full text-lg font-semibold sm:order-none sm:w-auto sm:whitespace-nowrap"
            aria-live="polite"
          >
            {tituloDoPeriodo(visao, data)}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Visualização"
            className="flex rounded-md border border-ink/15 p-0.5"
          >
            {VISOES.map((v) => (
              <button
                key={v.valor}
                type="button"
                aria-pressed={visao === v.valor}
                onClick={() => ir({ visao: v.valor })}
                className={cn(
                  'h-8 rounded px-3 text-sm font-semibold pointer-coarse:h-10',
                  visao === v.valor ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5',
                  v.tela === 'grande' && 'hidden sm:block',
                )}
              >
                {v.rotulo}
              </button>
            ))}
          </div>
          {/* Na semana as salas viram abas (abaixo); nas outras visões, uma lista. */}
          {visao !== 'semana' && (
            <>
              <label className="sr-only" htmlFor="filtro-sala">
                Sala
              </label>
              <Select
                id="filtro-sala"
                value={salaId}
                onChange={(e) => ir({ sala: e.target.value })}
                className="h-9 min-w-0 flex-1 pointer-coarse:h-10 sm:w-auto sm:min-w-48 sm:flex-none"
              >
                <option value="">Todas as salas</option>
                {(salas.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      </div>

      {visao === 'semana' && salas.data && salas.data.length > 0 && (
        <div
          role="group"
          aria-label="Sala"
          className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 py-0.5"
        >
          {salas.data.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === salaEfetiva}
              onClick={() => ir({ sala: s.id })}
              className={cn(
                'h-9 shrink-0 rounded-md border px-3 text-sm font-semibold pointer-coarse:h-10',
                s.id === salaEfetiva
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/15 bg-paper hover:border-ink/40',
              )}
            >
              {s.nome}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {visao !== 'agenda' && <Legenda visao={visao} />}
        {reservas.isSuccess && (
          <p className="text-sm text-muted" role="status">
            {contagem === 0
              ? `Nenhuma reserva ${periodoTexto}: todos os horários estão livres.`
              : `${contagem} reserva${contagem > 1 ? 's' : ''} ${periodoTexto}.`}
            {reservas.isFetching && ' Atualizando…'}
          </p>
        )}
      </div>

      {(config.isError || reservas.isError || salas.isError) && (
        <Alert
          tone="error"
          title={errorMessage(config.error ?? reservas.error ?? salas.error)}
          className="mb-4"
        />
      )}

      {(config.isPending || salas.isPending || reservas.isPending) &&
        !(config.isError || reservas.isError || salas.isError) && (
          <Spinner label="Carregando o calendário" />
        )}

      {config.data && salas.data && reservas.data && (
        <ConteudoCalendario
          visao={visao}
          data={data}
          hoje={hoje}
          reservas={lista}
          salas={salas.data}
          salaSelecionada={salaSelecionada}
          salaId={salaEfetiva}
          usuarioId={usuario?.id}
          config={config.data}
          // No celular o dia abre na Agenda; em telas maiores, na grade do dia.
          linkDoDia={(dia) =>
            link({ visao: visao === 'agenda' || ehCelular() ? 'agenda' : 'dia', data: dia })
          }
        />
      )}
    </>
  );
}

function ConteudoCalendario(props: {
  visao: Visao;
  data: string;
  hoje: string;
  reservas: Reserva[];
  salas: Sala[];
  salaSelecionada: Sala | undefined;
  salaId: string;
  usuarioId: string | undefined;
  config: Configuracoes;
  linkDoDia: (dia: string) => string;
}) {
  const { visao, data, hoje, reservas, salas, salaId, usuarioId, config } = props;
  const agora = new Date();
  const todasAsSalas = !salaId;

  if (salas.length === 0 && reservas.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={DoorOpen}
          title="Nenhuma sala disponível"
          description="Ainda não há salas cadastradas. O administrador cadastra as salas em Administração › Salas."
        />
      </Panel>
    );
  }

  if (visao === 'agenda') {
    return (
      <AgendaDia
        data={data}
        hoje={hoje}
        agora={agora}
        reservas={reservas}
        salas={salas}
        salaId={salaId}
        usuarioId={usuarioId}
        config={config}
        linkDoDia={props.linkDoDia}
      />
    );
  }

  if (visao === 'mes') {
    return (
      <CalendarioMes
        data={data}
        hoje={hoje}
        reservas={reservas}
        usuarioId={usuarioId}
        mostrarSala={todasAsSalas}
        linkDoDia={props.linkDoDia}
      />
    );
  }

  let colunas: ColunaGrade[];
  if (visao === 'semana') {
    colunas = diasDaSemana(data).map((dia) => ({
      chave: dia,
      data: dia,
      destaque: dia === hoje,
      reservas: reservas.filter((r) => dataDoInstante(r.inicio) === dia),
      titulo: (
        <Link
          to={props.linkDoDia(dia)}
          className={cn('font-semibold hover:underline', dia < hoje && 'text-muted')}
        >
          {diaCurto(dia)}
        </Link>
      ),
    }));
  } else if (!todasAsSalas) {
    const sala = props.salaSelecionada ?? reservas[0]?.sala;
    colunas = [
      {
        chave: salaId,
        data,
        sala: sala ? { id: salaId, nome: sala.nome } : undefined,
        reservas,
        titulo: <span className="font-semibold">{sala?.nome ?? 'Sala'}</span>,
      },
    ];
  } else {
    // Dia com todas as salas: uma coluna por sala (inclui sala desativada que ainda tenha reserva).
    const mapa = new Map<string, { id: string; nome: string; detalhe: string }>();
    for (const s of salas)
      mapa.set(s.id, { id: s.id, nome: s.nome, detalhe: `até ${s.capacidade}` });
    for (const r of reservas) {
      if (!mapa.has(r.sala.id)) {
        mapa.set(r.sala.id, { id: r.sala.id, nome: r.sala.nome, detalhe: 'desativada' });
      }
    }
    colunas = [...mapa.values()].map((s) => ({
      chave: s.id,
      data,
      sala: { id: s.id, nome: s.nome },
      reservas: reservas.filter((r) => r.sala.id === s.id),
      titulo: (
        <>
          <span className="block truncate font-semibold">{s.nome}</span>
          <span className="block text-xs text-muted">{s.detalhe}</span>
        </>
      ),
    }));
  }

  return (
    <GradeHorarios
      colunas={colunas}
      config={config}
      agora={agora}
      usuarioId={usuarioId}
      mostrarSala={visao === 'semana' && todasAsSalas}
      salaFiltro={salaId || undefined}
      // Semana com colunas mais estreitas: os 7 dias cabem a partir do tablet.
      larguraColuna={visao === 'semana' ? 88 : 120}
    />
  );
}
