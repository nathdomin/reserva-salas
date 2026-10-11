import {
  configuracoesResponseSchema,
  listaReservasResponseSchema,
  reservaResponseSchema,
  type Configuracoes,
  type EditarReservaInput,
  type Reserva,
  type ReservaInput,
} from '@reserva/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export function useConfiguracoes() {
  return useQuery({
    queryKey: ['configuracoes'],
    queryFn: async (): Promise<Configuracoes> =>
      configuracoesResponseSchema.parse(await apiFetch<unknown>('/configuracoes')).configuracoes,
    staleTime: 5 * 60_000,
  });
}

export interface FiltrosPeriodo {
  dataInicio: string;
  dataFim: string;
  salaId?: string | undefined;
  usuarioId?: string | undefined;
  incluirCanceladas?: boolean | undefined;
}

/** Reservas entre duas datas (inclusive). Atualiza sozinho a cada 30 s. */
export function useReservasPeriodo(
  filtros: FiltrosPeriodo,
  opcoes: { enabled?: boolean; manterAnterior?: boolean } = {},
) {
  return useQuery({
    queryKey: ['reservas', 'periodo', filtros],
    queryFn: async (): Promise<Reserva[]> => {
      const params = new URLSearchParams({
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
      });
      if (filtros.salaId) params.set('salaId', filtros.salaId);
      if (filtros.usuarioId) params.set('usuarioId', filtros.usuarioId);
      if (filtros.incluirCanceladas) params.set('incluirCanceladas', 'true');
      const data = await apiFetch<unknown>(`/reservas?${params.toString()}`);
      return listaReservasResponseSchema.parse(data).reservas;
    },
    refetchInterval: 30_000,
    enabled: opcoes.enabled ?? true,
    // Ao trocar de semana/mês, mantém a tela anterior até os novos dados chegarem.
    ...(opcoes.manterAnterior ? { placeholderData: keepPreviousData } : {}),
  });
}

export function useMinhasReservas(tipo: 'proximas' | 'anteriores', limite = 20) {
  return useQuery({
    queryKey: ['reservas', 'minhas', tipo, limite],
    queryFn: async (): Promise<Reserva[]> => {
      const data = await apiFetch<unknown>(`/reservas/minhas?tipo=${tipo}&limite=${limite}`);
      return listaReservasResponseSchema.parse(data).reservas;
    },
    refetchInterval: 60_000,
    // "Mostrar mais": mantém a lista na tela enquanto carrega (só dentro da mesma aba).
    placeholderData: (anterior, consulta) =>
      consulta?.queryKey[2] === tipo ? anterior : undefined,
  });
}

export function useReserva(id: string | undefined) {
  return useQuery({
    queryKey: ['reservas', 'detalhe', id],
    queryFn: async (): Promise<Reserva> => {
      const data = await apiFetch<unknown>(`/reservas/${encodeURIComponent(id ?? '')}`);
      return reservaResponseSchema.parse(data).reserva;
    },
    enabled: Boolean(id),
  });
}

function useInvalidarReservas() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['reservas'] });
    void queryClient.invalidateQueries({ queryKey: ['auditoria'] });
  };
}

export function useCriarReserva() {
  const invalidar = useInvalidarReservas();
  return useMutation({
    mutationFn: async (dados: ReservaInput) => {
      const data = await apiFetch<unknown>('/reservas', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
      return reservaResponseSchema.parse(data).reserva;
    },
    onSuccess: invalidar,
  });
}

export function useEditarReserva(id: string) {
  const invalidar = useInvalidarReservas();
  return useMutation({
    mutationFn: async (dados: EditarReservaInput) => {
      const data = await apiFetch<unknown>(`/reservas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(dados),
      });
      return reservaResponseSchema.parse(data).reserva;
    },
    onSuccess: invalidar,
  });
}

export function useCancelarReserva(id: string) {
  const invalidar = useInvalidarReservas();
  return useMutation({
    mutationFn: async (motivo: string | undefined) => {
      const data = await apiFetch<unknown>(`/reservas/${encodeURIComponent(id)}/cancelar`, {
        method: 'POST',
        body: JSON.stringify(motivo ? { motivo } : {}),
      });
      return reservaResponseSchema.parse(data).reserva;
    },
    onSuccess: invalidar,
  });
}
