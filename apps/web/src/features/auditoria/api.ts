import {
  listaAuditoriaResponseSchema,
  type AcaoAuditoria,
  type EntidadeAuditoria,
  type ListaAuditoria,
} from '@reserva/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export interface FiltrosAuditoria {
  dataInicio?: string | undefined;
  dataFim?: string | undefined;
  entidade?: EntidadeAuditoria | undefined;
  entidadeId?: string | undefined;
  acao?: AcaoAuditoria | undefined;
  atorId?: string | undefined;
}

const CHAVES = [
  'dataInicio',
  'dataFim',
  'entidade',
  'entidadeId',
  'acao',
  'atorId',
] as const satisfies readonly (keyof FiltrosAuditoria)[];

/** Histórico de alterações, em páginas ("Carregar mais"). Somente administradores. */
export function useAuditoria(filtros: FiltrosAuditoria, opcoes: { limite?: number } = {}) {
  const limite = opcoes.limite ?? 50;
  return useInfiniteQuery({
    queryKey: ['auditoria', filtros, limite],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }): Promise<ListaAuditoria> => {
      // Ordem fixa dos parâmetros (URL previsível).
      const params = new URLSearchParams();
      for (const chave of CHAVES) {
        const valor = filtros[chave];
        if (valor) params.set(chave, valor);
      }
      params.set('limite', String(limite));
      if (pageParam) params.set('antesDe', String(pageParam));
      const data = await apiFetch<unknown>(`/admin/auditoria?${params.toString()}`);
      return listaAuditoriaResponseSchema.parse(data);
    },
    getNextPageParam: (ultima) => ultima.proximo,
  });
}
