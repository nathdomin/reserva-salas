import {
  listaSalasResponseSchema,
  salaResponseSchema,
  type AtualizarSalaInput,
  type Sala,
  type SalaInput,
} from '@reserva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export function useSalas(incluirInativas = false) {
  return useQuery({
    queryKey: ['salas', { incluirInativas }],
    queryFn: async (): Promise<Sala[]> => {
      const data = await apiFetch<unknown>(
        `/salas${incluirInativas ? '?incluirInativas=true' : ''}`,
      );
      return listaSalasResponseSchema.parse(data).salas;
    },
    staleTime: 60_000,
  });
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['salas'] });
    void queryClient.invalidateQueries({ queryKey: ['reservas'] });
  };
}

export function useCriarSala() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (dados: SalaInput) => {
      const data = await apiFetch<unknown>('/admin/salas', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
      return salaResponseSchema.parse(data).sala;
    },
    onSuccess: invalidar,
  });
}

export function useAtualizarSala() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: AtualizarSalaInput }) => {
      const data = await apiFetch<{ reservasCanceladas?: number }>(
        `/admin/salas/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(dados) },
      );
      return {
        sala: salaResponseSchema.parse(data).sala,
        reservasCanceladas: data.reservasCanceladas ?? 0,
      };
    },
    onSuccess: invalidar,
  });
}
