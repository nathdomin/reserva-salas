import { emMinutos, type Configuracoes, type Reserva } from '@reserva/shared';
import { minutosDoInstante, montarAgenda, type TrechoAgenda } from '../../lib/calendario';

/**
 * Primeiro horário ainda reservável no dia, em minutos: hoje, o próximo horário a partir
 * de agora; em dia futuro, a abertura; em dia passado, o fechamento (nada livre).
 */
export function livreDesdeNoDia(
  data: string,
  hoje: string,
  agora: Date,
  config: Configuracoes,
): number {
  const abertura = emMinutos(config.horarioInicio);
  const fechamento = emMinutos(config.horarioFim);
  if (data < hoje) return fechamento;
  if (data > hoje) return abertura;
  const passo = config.granularidadeMinutos;
  const agoraMin = minutosDoInstante(agora.toISOString());
  return Math.max(abertura, Math.ceil(agoraMin / passo) * passo);
}

/** Reservas e intervalos livres de uma sala no dia (só reservas ativas). */
export function trechosDaSala(
  reservasDoDia: Reserva[],
  config: Configuracoes,
  livreDesde: number,
): TrechoAgenda<Reserva>[] {
  const abertura = emMinutos(config.horarioInicio);
  const fechamento = emMinutos(config.horarioFim);
  return montarAgenda(
    reservasDoDia.filter((r) => r.status !== 'CANCELADA'),
    (r) => (r.diaInteiro ? abertura : minutosDoInstante(r.inicio)),
    (r) => (r.diaInteiro ? fechamento : minutosDoInstante(r.fim)),
    { abertura, fechamento, livreDesde, duracaoMinima: config.duracaoMinimaMinutos },
  );
}

/** Fim (em minutos) do intervalo livre que começa já no próximo horário, se houver. */
export function livreAte(trechos: TrechoAgenda<Reserva>[], livreDesde: number): number | null {
  const t = trechos.find((x) => x.tipo === 'livre' && x.inicio === livreDesde);
  return t ? t.fim : null;
}
