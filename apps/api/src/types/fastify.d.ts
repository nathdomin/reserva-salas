import type { UsuarioSessao } from '@reserva/shared';

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido pelas guardas de autenticação (null em rotas públicas). */
    usuario: UsuarioSessao | null;
    /** Id (hash) da sessão atual. */
    sessaoId: string | null;
  }
}
