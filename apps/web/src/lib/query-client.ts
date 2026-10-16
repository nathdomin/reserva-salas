import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ERROR_CODES } from '@reserva/shared';
import { ApiError } from './api';

const SESSAO_KEY = ['sessao'];

export function createQueryClient() {
  // Se qualquer chamada responder 401 (sessão expirada ou encerrada pelo administrador),
  // a sessão local é zerada e as rotas protegidas levam o usuário para o login.
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.setQueryData(SESSAO_KEY, null);
    }
    // O administrador redefiniu a senha durante o uso: recarrega a sessão, que leva à troca.
    if (error instanceof ApiError && error.code === ERROR_CODES.TROCA_DE_SENHA_OBRIGATORIA) {
      void queryClient.invalidateQueries({ queryKey: SESSAO_KEY });
    }
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        // Mantém os dados atualizados entre usuários: recarrega ao voltar para a aba.
        refetchOnWindowFocus: true,
        staleTime: 15_000,
        retry: (failureCount, error) => {
          // Erros 4xx não melhoram tentando de novo.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });

  return queryClient;
}
