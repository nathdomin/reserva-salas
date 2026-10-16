import type { Perfil, UsuarioSessao } from '@reserva/shared';
import type { Queryable } from '../../db/client';
import {
  CARREGAR_SESSAO,
  CRIAR_SESSAO,
  LIMPAR_SESSOES_EXPIRADAS,
  REMOVER_SESSAO,
  REMOVER_SESSOES_DO_USUARIO,
} from './sql';
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from './tokens';

export interface SessionConfig {
  /** Encerra a sessão após este tempo sem uso. */
  idleMinutes: number;
  /** Encerra a sessão após este tempo desde o login, mesmo com uso. */
  maxHours: number;
  /** Cookie só trafega em HTTPS (produção). */
  secureCookie: boolean;
}

/** O prefixo __Host- obriga o navegador a aceitar o cookie só via HTTPS, no domínio exato. */
export function sessionCookieName(secure: boolean) {
  return secure ? '__Host-reserva_sessao' : 'reserva_sessao';
}

export interface SessionCookieOptions {
  path: '/';
  httpOnly: true;
  sameSite: 'strict';
  secure: boolean;
}

export function sessionCookieOptions(secure: boolean): SessionCookieOptions {
  // Sem maxAge: cookie de sessão do navegador. A expiração real é controlada no banco.
  return { path: '/', httpOnly: true, sameSite: 'strict', secure };
}

export interface SessionMeta {
  ip: string | null;
  userAgent: string | null;
}

export function createSessionService(db: Queryable, config: SessionConfig) {
  const cookieName = sessionCookieName(config.secureCookie);
  const cookieOptions = sessionCookieOptions(config.secureCookie);

  return {
    cookieName,
    cookieOptions,

    /** Cria a sessão e devolve o token que vai no cookie (o banco guarda só o hash). */
    async create(usuarioId: string, meta: SessionMeta): Promise<{ token: string; id: string }> {
      const { token, id } = generateSessionToken();
      await db.query(CRIAR_SESSAO, [
        id,
        usuarioId,
        config.idleMinutes,
        meta.ip,
        meta.userAgent?.slice(0, 300) ?? null,
      ]);
      return { token, id };
    },

    /** Usuário dono do token, se a sessão for válida e o usuário estiver ativo. */
    async load(token: string | undefined): Promise<{ usuario: UsuarioSessao; id: string } | null> {
      if (!token || !isWellFormedSessionToken(token)) return null;
      const id = hashSessionToken(token);
      const { rows } = await db.query<{
        id: string;
        nome: string;
        email: string;
        perfil: Perfil;
        trocar_senha: boolean;
      }>(CARREGAR_SESSAO, [id, config.idleMinutes, config.maxHours]);
      const row = rows[0];
      if (!row) return null;
      return {
        id,
        usuario: {
          id: row.id,
          nome: row.nome,
          email: row.email,
          perfil: row.perfil,
          trocarSenha: row.trocar_senha,
        },
      };
    },

    async revokeToken(token: string | undefined) {
      if (!token || !isWellFormedSessionToken(token)) return;
      await db.query(REMOVER_SESSAO, [hashSessionToken(token)]);
    },

    /** Encerra as sessões do usuário (menos `exceptSessionId`); devolve quantas eram. */
    async revokeAllForUser(
      usuarioId: string,
      exceptSessionId: string | null = null,
      q = db,
    ): Promise<number> {
      const { rowCount } = await q.query(REMOVER_SESSOES_DO_USUARIO, [usuarioId, exceptSessionId]);
      return rowCount ?? 0;
    },

    async cleanupExpired() {
      await db.query(LIMPAR_SESSOES_EXPIRADAS, [config.maxHours]);
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
