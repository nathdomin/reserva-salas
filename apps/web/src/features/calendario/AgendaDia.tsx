import { emMinutos, paraHora, type Configuracoes, type Reserva, type Sala } from '@reserva/shared';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import {
  dataDoInstante,
  diasDaSemana,
  minutosDoInstante,
  nomeCurtoDoDia,
  type TrechoAgenda,
} from '../../lib/calendario';
import { ESTILO_MINHA, ESTILO_OCUPADO } from './estilos';
import { livreAte, livreDesdeNoDia, trechosDaSala } from './livres';
import { RecursosSala } from '../salas/RecursosSala';

interface AgendaDiaProps {
  data: string;
  hoje: string;
  agora: Date;
  /** Reservas da semana inteira (a faixa de dias mostra quais dias têm reuniões). */
  reservas: Reserva[];
  salas: Sala[];
  salaId: string;
  usuarioId: string | undefined;
  config: Configuracoes;
  linkDoDia: (dia: string) => string;
}

interface SalaAgenda {
  id: string;
  nome: string;
  detalhe: string;
  recursos: string[];
  trechos: TrechoAgenda<Reserva>[];
}

/**
 * Visão Agenda (celular): faixa com os dias da semana e, para cada sala, a lista do dia
 * com as reservas e os intervalos livres, cada um com um botão para reservar.
 */
export function AgendaDia({
  data,
  hoje,
  agora,
  reservas,
  salas,
  salaId,
  usuarioId,
  config,
  linkDoDia,
}: AgendaDiaProps) {
  const ativas = reservas.filter((r) => r.status !== 'CANCELADA');
  const doDia = ativas.filter((r) => dataDoInstante(r.inicio) === data);
  const fechamento = emMinutos(config.horarioFim);

  // Hoje: livre só a partir do próximo horário reservável. Dia passado: nada livre.
  const livreDesde = livreDesdeNoDia(data, hoje, agora, config);

  // Salas ativas e, se houver, sala desativada que ainda tem reserva no dia.
  const mapa = new Map<string, { id: string; nome: string; detalhe: string; recursos: string[] }>();
  for (const s of salas) {
    mapa.set(s.id, {
      id: s.id,
      nome: s.nome,
      detalhe: `${s.localizacao} · até ${s.capacidade} pessoas`,
      recursos: s.recursos,
    });
  }
  for (const r of doDia) {
    if (!mapa.has(r.sala.id)) {
      mapa.set(r.sala.id, {
        id: r.sala.id,
        nome: r.sala.nome,
        detalhe: 'Sala desativada',
        recursos: [],
      });
    }
  }
  const lista: SalaAgenda[] = [...mapa.values()]
    .filter((s) => !salaId || s.id === salaId)
    .map((s) => ({
      ...s,
      trechos: trechosDaSala(
        doDia.filter((r) => r.sala.id === s.id),
        config,
        livreDesde,
      ),
    }));

  // "Livres agora": salas com um intervalo livre que começa no próximo horário.
  const dentroDoExpediente = data === hoje && livreDesde < fechamento;
  const livresAgora = dentroDoExpediente
    ? lista.flatMap((s) => {
        const ate = livreAte(s.trechos, livreDesde);
        return ate === null ? [] : [{ nome: s.nome, ate: paraHora(ate) }];
      })
    : [];

  const porDia = new Map<string, number>();
  for (const r of ativas) {
    const dia = dataDoInstante(r.inicio);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Dias da semana">
        <ol className="grid grid-cols-7 gap-1">
          {diasDaSemana(data).map((dia) => {
            const selecionado = dia === data;
            const qtd = porDia.get(dia) ?? 0;
            return (
              <li key={dia}>
                <Link
                  to={linkDoDia(dia)}
                  aria-current={selecionado ? 'date' : undefined}
                  aria-label={`${nomeCurtoDoDia(dia)} ${Number(dia.slice(8))}${
                    dia === hoje ? ', hoje' : ''
                  }: ${qtd === 0 ? 'sem reservas' : `${qtd} reserva${qtd > 1 ? 's' : ''}`}`}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center gap-0.5 rounded-md border text-sm sm:h-18',
                    selecionado
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line bg-paper hover:border-ink/40',
                    !selecionado && dia < hoje && 'text-muted',
                  )}
                >
                  <span className="text-xs">{nomeCurtoDoDia(dia).replace('.', '')}</span>
                  <span
                    className={cn(
                      'text-base leading-none font-semibold sm:text-lg',
                      dia === hoje && !selecionado && 'text-brand-strong',
                    )}
                  >
                    {Number(dia.slice(8))}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 rounded-full',
                      qtd === 0 ? 'bg-transparent' : selecionado ? 'bg-paper' : 'bg-ink/50',
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      {livresAgora.length > 0 && (
        <p className="rounded-md border-l-4 border-ok bg-paper px-3 py-2 text-sm">
          <span
            aria-hidden
            className="relative mr-2 inline-block size-2 rounded-full bg-ok align-middle"
          >
            <span className="absolute inset-0 animate-pulsar rounded-full bg-ok" />
          </span>
          <span className="font-semibold">Livres agora: </span>
          {livresAgora.map((s) => `${s.nome} (até ${s.ate})`).join(', ')}
        </p>
      )}

      {/* Uma coluna no celular; em telas maiores, os cartões das salas lado a lado. */}
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((sala) => (
          <section
            key={sala.id}
            aria-labelledby={`agenda-${sala.id}`}
            className="overflow-hidden rounded-xl border border-line bg-paper shadow-card"
          >
            <header className="border-b border-line px-4 py-3">
              <h3 id={`agenda-${sala.id}`} className="font-semibold">
                {sala.nome}
              </h3>
              <p className="text-sm text-muted">{sala.detalhe}</p>
              <RecursosSala recursos={sala.recursos} compacto className="mt-2" />
            </header>
            {sala.trechos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">
                {data < hoje ? 'Nenhuma reserva neste dia.' : 'Sem horários livres neste dia.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {sala.trechos.map((t) => (
                  <li key={t.tipo === 'livre' ? `livre-${t.inicio}` : t.item.id}>
                    {t.tipo === 'livre' ? (
                      <TrechoLivre data={data} sala={sala} inicio={t.inicio} fim={t.fim} />
                    ) : (
                      <TrechoOcupado reserva={t.item} minha={t.item.responsavel.id === usuarioId} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function TrechoLivre(props: { data: string; sala: SalaAgenda; inicio: number; fim: number }) {
  const inicio = paraHora(props.inicio);
  const params = new URLSearchParams({ data: props.data, inicio, salaId: props.sala.id });
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <p className="text-sm">
        <span className="font-semibold tabular-nums">
          {inicio}–{paraHora(props.fim)}
        </span>
        <span className="ml-2 text-ok">Livre</span>
      </p>
      <Link
        to={`/reservas/nova?${params.toString()}`}
        aria-label={`Reservar ${props.sala.nome} às ${inicio}`}
        className={buttonClasses('secondary', 'sm', 'shrink-0')}
      >
        <Plus aria-hidden className="size-4" />
        Reservar
      </Link>
    </div>
  );
}

function TrechoOcupado({ reserva: r, minha }: { reserva: Reserva; minha: boolean }) {
  const horario = r.diaInteiro
    ? 'Dia inteiro'
    : `${paraHora(minutosDoInstante(r.inicio))}–${paraHora(minutosDoInstante(r.fim))}`;
  return (
    <Link
      to={`/reservas/${r.id}`}
      className={cn('block px-4 py-2 hover:brightness-95', minha ? ESTILO_MINHA : ESTILO_OCUPADO)}
    >
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{horario}</span>
        <span className="ml-2 text-muted">{minha ? 'Sua reserva' : 'Ocupado'}</span>
      </p>
      <p className="truncate text-sm">
        {r.motivo}
        <span className="text-muted"> · {r.responsavel.nome}</span>
      </p>
    </Link>
  );
}
