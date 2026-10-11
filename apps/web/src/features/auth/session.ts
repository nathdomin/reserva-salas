import {
  sessaoResponseSchema,
  type AlterarSenhaInput,
  type LoginInput,
  type UsuarioSessao,
} from '@reserva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../lib/api';

export const SESSAO_KEY = ['sessao'] as const;

/** Remove do cache tudo que não é a sessão: dados de um usuário nunca aparecem para outro. */
function limparDadosDoUsuario(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSAO_KEY[0] });
}

/** Usuário logado, ou null se não houver sessão válida. */
export async function fetchSessao(): Promise<UsuarioSessao | null> {
  try {
    const data = await apiFetch<unknown>('/auth/me');
    return sessaoResponseSchema.parse(data).usuario;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useSessao() {
  return useQuery({
    queryKey: SESSAO_KEY,
    queryFn: fetchSessao,
    staleTime: 60_000,
    // Ao voltar para a aba, confirma se a sessão ainda vale (ex.: logout em outra aba).
    refetchOnWindowFocus: true,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const data = await apiFetch<unknown>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return sessaoResponseSchema.parse(data).usuario;
    },
    onSuccess: (usuario) => {
      limparDadosDoUsuario(queryClient);
      queryClient.setQueryData(SESSAO_KEY, usuario);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      limparDadosDoUsuario(queryClient);
      queryClient.setQueryData(SESSAO_KEY, null);
    },
  });
}

export function useAlterarSenha() {
  return useMutation({
    mutationFn: (input: AlterarSenhaInput) =>
      apiFetch<void>('/auth/alterar-senha', { method: 'POST', body: JSON.stringify(input) }),
  });
}
