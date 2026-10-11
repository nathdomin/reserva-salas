import {
  atualizarUsuarioResponseSchema,
  listaUsuariosResponseSchema,
  usuarioResponseSchema,
  type AtualizarUsuarioInput,
  type CriarUsuarioInput,
  type UsuarioAdmin,
} from '@reserva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

const USUARIOS_KEY = ['usuarios'] as const;

export function useUsuarios() {
  return useQuery({
    queryKey: USUARIOS_KEY,
    queryFn: async (): Promise<UsuarioAdmin[]> => {
      const data = await apiFetch<unknown>('/admin/usuarios');
      return listaUsuariosResponseSchema.parse(data).usuarios;
    },
  });
}

function useInvalidarUsuarios() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: USUARIOS_KEY });
}

export function useCriarUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: async (input: CriarUsuarioInput) => {
      const data = await apiFetch<unknown>('/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return usuarioResponseSchema.parse(data).usuario;
    },
    onSuccess: invalidar,
  });
}

export function useAtualizarUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: AtualizarUsuarioInput }) => {
      const data = await apiFetch<unknown>(`/admin/usuarios/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(dados),
      });
      return atualizarUsuarioResponseSchema.parse(data);
    },
    onSuccess: invalidar,
  });
}

export function useRedefinirSenha() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: ({ id, novaSenha }: { id: string; novaSenha: string }) =>
      apiFetch<void>(`/admin/usuarios/${encodeURIComponent(id)}/redefinir-senha`, {
        method: 'POST',
        body: JSON.stringify({ novaSenha }),
      }),
    onSuccess: invalidar,
  });
}
