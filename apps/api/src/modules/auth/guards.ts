import { ERROR_CODES, type UsuarioSessao } from '@reserva/shared';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../../plugins/errors';
import type { SessionService } from './session';

export function createAuthGuards(sessions: SessionService) {
  /** Exige uma sessão válida. Toda a verificação acontece no backend. */
  async function requireAuth(request: FastifyRequest): Promise<void> {
    const session = await sessions.load(request.cookies[sessions.cookieName]);
    if (!session) {
      throw new AppError(
        401,
        ERROR_CODES.NAO_AUTENTICADO,
        'Sua sessão expirou ou você ainda não entrou. Faça login para continuar.',
      );
    }
    request.usuario = session.usuario;
    request.sessaoId = session.id;
  }

  /** Exige sessão válida E perfil de administrador (lido do banco a cada requisição). */
  async function requireAdmin(request: FastifyRequest): Promise<void> {
    await requireAuth(request);
    if (request.usuario?.perfil !== 'ADMIN') {
      throw new AppError(
        403,
        ERROR_CODES.SEM_PERMISSAO,
        'Você não tem permissão para acessar esta área.',
      );
    }
  }

  return { requireAuth, requireAdmin };
}

export type AuthGuards = ReturnType<typeof createAuthGuards>;

/** Usuário autenticado (use só em rotas protegidas por requireAuth/requireAdmin). */
export function usuarioAtual(request: FastifyRequest): UsuarioSessao {
  if (!request.usuario) {
    throw new AppError(401, ERROR_CODES.NAO_AUTENTICADO, 'Faça login para continuar.');
  }
  return request.usuario;
}
