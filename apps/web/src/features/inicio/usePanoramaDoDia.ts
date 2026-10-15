import { emMinutos, paraHora, type Sala } from '@reserva/shared';
import { dataDoInstante } from '../../lib/calendario';
import { livreAte, livreDesdeNoDia, trechosDaSala } from '../calendario/livres';
import { useConfiguracoes, useReservasPeriodo } from '../reservas/api';
import { useSalas } from '../salas/api';

export interface SalaLivre {
  sala: Sala;
  /** Horário (HH:MM) em que a reserva pode começar e até quando a sala fica livre. */
  inicio: string;
  ate: string;
}

/** Visão de hoje para a tela inicial: salas livres agora e contagens do dia. */
export function usePanoramaDoDia(hoje: string, agora: Date, usuarioId: string | undefined) {
  const config = useConfiguracoes();
  const salas = useSalas(false);
  const reservas = useReservasPeriodo({ dataInicio: hoje, dataFim: hoje });

  if (!config.data || !salas.data || !reservas.data) {
    const erro = config.isError || salas.isError || reservas.isError;
    return { pronto: false as const, erro };
  }

  const doDia = reservas.data.filter(
    (r) => r.status !== 'CANCELADA' && dataDoInstante(r.inicio) === hoje,
  );
  const livreDesde = livreDesdeNoDia(hoje, hoje, agora, config.data);
  const expedienteAcabou = livreDesde >= emMinutos(config.data.horarioFim);

  const livres: SalaLivre[] = expedienteAcabou
    ? []
    : salas.data.flatMap((sala) => {
        const trechos = trechosDaSala(
          doDia.filter((r) => r.sala.id === sala.id),
          config.data,
          livreDesde,
        );
        const ate = livreAte(trechos, livreDesde);
        return ate === null ? [] : [{ sala, inicio: paraHora(livreDesde), ate: paraHora(ate) }];
      });

  return {
    pronto: true as const,
    erro: false,
    config: config.data,
    expedienteAcabou,
    livres,
    totalSalas: salas.data.length,
    reservasHoje: doDia.length,
    suasHoje: doDia.filter((r) => r.responsavel.id === usuarioId).length,
  };
}
