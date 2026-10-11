import {
  alterarSenhaSchema,
  ERROR_CODES,
  loginSchema,
  type Perfil,
  type UsuarioSessao,
} from '@reserva/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Database } from '../../db/client';
import { AppError } from '../../plugins/errors';
import { registrarAuditoria } from '../audit/service';
import type { AuthGuards } from './guards';
import { usuarioAtual } from './guards';
import { createBloqueioSimulado } from './bloqueio-simulado';
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword } from './password';
import type { SessionService } from './session';
import {
  ALTERAR_SENHA,
  ATUALIZAR_HASH_SENHA,
  BUSCAR_HASH_SENHA,
  BUSCAR_USUARIO_LOGIN,
  REGISTRAR_FALHA_LOGIN,
  REGISTRAR_LOGIN_SUCESSO,
} from './sql';

/** Falhas seguidas antes do bloqueio temporário. */
export const MAX_TENTATIVAS_LOGIN = 5;
export const BLOQUEIO_MINUTOS = 15;

interface AuthRoutesOptions {
  database: Database;
  sessions: SessionService;
  guards: AuthGuards;
  loginRateLimitMax: number;
}

type UsuarioLoginRow = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  senha_hash: string;
  bloqueado: boolean;
};

const credenciaisInvalidas = () =>
  new AppError(401, ERROR_CODES.CREDENCIAIS_INVALIDAS, 'E-mail ou senha incorretos.');

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const { database, sessions, guards } = options;
  const db = database.pool;
  const rateLimit = { rateLimit: { max: options.loginRateLimitMax, timeWindow: '1 minute' } };
  const bloqueioSimulado = createBloqueioSimulado({
    maxTentativas: MAX_TENTATIVAS_LOGIN,
    bloqueioMinutos: BLOQUEIO_MINUTOS,
  });
  const contaBloqueada = () =>
    new AppError(
      429,
      ERROR_CODES.CONTA_BLOQUEADA,
      `Muitas tentativas sem sucesso. Por segurança, o acesso foi bloqueado por ${BLOQUEIO_MINUTOS} minutos.`,
    );

  app.post('/login', { config: rateLimit }, async (request, reply) => {
    const { email, senha } = loginSchema.parse(request.body ?? {});

    const { rows } = await db.query<UsuarioLoginRow>(BUSCAR_USUARIO_LOGIN, [email]);
    const usuario = rows[0];

    // E-mail inexistente se comporta como uma conta real (mesmo tempo de resposta e o mesmo
    // bloqueio após várias tentativas): as respostas não revelam quem tem conta.
    if (!usuario) {
      await verifyAgainstDummy(senha);
      if (bloqueioSimulado.bloqueado(email)) throw contaBloqueada();
      bloqueioSimulado.registrarFalha(email);
      throw credenciaisInvalidas();
    }

    if (usuario.bloqueado) {
      await verifyAgainstDummy(senha);
      throw contaBloqueada();
    }

    if (!(await verifyPassword(senha, usuario.senha_hash))) {
      const falha = await db.query<{ bloqueado: boolean }>(REGISTRAR_FALHA_LOGIN, [
        usuario.id,
        MAX_TENTATIVAS_LOGIN,
        BLOQUEIO_MINUTOS,
      ]);
      await registrarAuditoria(db, {
        atorId: null,
        acao: 'LOGIN_FALHO',
        entidade: 'usuario',
        entidadeId: usuario.id,
        ip: request.ip,
      });
      if (falha.rows[0]?.bloqueado) {
        await registrarAuditoria(db, {
          atorId: null,
          acao: 'CONTA_BLOQUEADA',
          entidade: 'usuario',
          entidadeId: usuario.id,
          depois: { minutos: BLOQUEIO_MINUTOS },
          ip: request.ip,
        });
      }
      throw credenciaisInvalidas();
    }

    // Só informa que o usuário está desativado para quem acertou a senha.
    if (!usuario.ativo) {
      throw new AppError(
        403,
        ERROR_CODES.USUARIO_INATIVO,
        'Seu acesso está desativado. Fale com o administrador do sistema.',
      );
    }

    await db.query(REGISTRAR_LOGIN_SUCESSO, [usuario.id]);
    if (needsRehash(usuario.senha_hash)) {
      await db.query(ATUALIZAR_HASH_SENHA, [usuario.id, await hashPassword(senha)]);
    }

    // Uma sessão anterior neste navegador é descartada (evita fixação de sessão).
    await sessions.revokeToken(request.cookies[sessions.cookieName]);
    const { token } = await sessions.create(usuario.id, {
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });
    await sessions.cleanupExpired();

    const sessao: UsuarioSessao = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    reply.setCookie(sessions.cookieName, token, sessions.cookieOptions);
    return { usuario: sessao };
  });

  app.post('/logout', async (request, reply) => {
    await sessions.revokeToken(request.cookies[sessions.cookieName]);
    reply.clearCookie(sessions.cookieName, sessions.cookieOptions);
    return reply.status(204).send();
  });

  app.get('/me', { preHandler: guards.requireAuth }, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return { usuario: usuarioAtual(request) };
  });

  app.post(
    '/alterar-senha',
    { preHandler: guards.requireAuth, config: rateLimit },
    async (request, reply) => {
      const usuario = usuarioAtual(request);
      const { senhaAtual, novaSenha } = alterarSenhaSchema.parse(request.body ?? {});

      const { rows } = await db.query<{ senha_hash: string }>(BUSCAR_HASH_SENHA, [usuario.id]);
      const atual = rows[0];
      if (!atual || !(await verifyPassword(senhaAtual, atual.senha_hash))) {
        throw new AppError(400, ERROR_CODES.SENHA_ATUAL_INCORRETA, 'A senha atual não confere.', [
          { campo: 'senhaAtual', mensagem: 'A senha atual não confere.' },
        ]);
      }
      if (novaSenha.trim().toLowerCase() === usuario.email) {
        throw new AppError(400, ERROR_CODES.VALIDATION, 'A senha não pode ser igual ao e-mail.', [
          { campo: 'novaSenha', mensagem: 'A senha não pode ser igual ao e-mail.' },
        ]);
      }

      const novoHash = await hashPassword(novaSenha);
      await database.transaction(async (tx) => {
        await tx.query(ALTERAR_SENHA, [usuario.id, novoHash]);
        // Encerra as sessões em outros navegadores; mantém a atual.
        await sessions.revokeAllForUser(usuario.id, request.sessaoId, tx);
        await registrarAuditoria(tx, {
          atorId: usuario.id,
          acao: 'SENHA_ALTERADA',
          entidade: 'usuario',
          entidadeId: usuario.id,
          ip: request.ip,
        });
      });
      return reply.status(204).send();
    },
  );
};
