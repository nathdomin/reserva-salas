import {
  configuracoesResponseSchema,
  type AtualizarConfiguracoesInput,
  type Configuracoes,
} from '@reserva/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

/** Altera as regras de funcionamento (somente administrador). */
export function useAtualizarConfiguracoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: AtualizarConfiguracoesInput): Promise<Configuracoes> => {
      const data = await apiFetch<unknown>('/admin/configuracoes', {
        method: 'PATCH',
        body: JSON.stringify(dados),
      });
      return configuracoesResponseSchema.parse(data).configuracoes;
    },
    onSuccess: (configuracoes) => {
      queryClient.setQueryData(['configuracoes'], configuracoes);
      // A visibilidade do motivo muda o que a API devolve nas reservas.
      void queryClient.invalidateQueries({ queryKey: ['reservas'] });
      void queryClient.invalidateQueries({ queryKey: ['auditoria'] });
    },
  });
}
