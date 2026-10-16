import {
  alterarSenhaSchema,
  ERROR_CODES,
  loginSchema,
  type Perfil,
  type UsuarioSessao,
} from '@reserva/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Database } from '../../db/client';
import { AppError } from '../../plugins/errors';
import { registrarAuditoria } from '../audit/service';
import { desativarContasSemUso } from '../users/service';
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
/** Teto do bloqueio progressivo (1, 2, 4, 8 e no máximo 15 minutos). */
export const BLOQUEIO_MAXIMO_MINUTOS = 15;
/** Tentativas de troca da própria senha por minuto, por pessoa (protege a senha atual). */
export const TROCAS_DE_SENHA_POR_MINUTO = 5;

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
  trocar_senha: boolean;
  minutos_bloqueio: number | null;
  sem_uso: boolean;
};

const credenciaisInvalidas = () =>
  new AppError(401, ERROR_CODES.CREDENCIAIS_INVALIDAS, 'E-mail ou senha incorretos.');

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const { database, sessions, guards } = options;
  const db = database.pool;
  // Login: por IP. Cada conta já é protegida pelo bloqueio após 5 senhas erradas; este limite
  // protege o servidor (o cálculo da senha é caro) e não aceita um cookie qualquer como chave,
  // senão bastaria trocar o cookie a cada tentativa.
  const limiteLogin = {
    rateLimit: {
      max: options.loginRateLimitMax,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => request.ip,
    },
  };
  // Troca de senha: por pessoa, depois de confirmar a sessão (colegas no mesmo IP não se afetam).
  const limiteTrocaDeSenha = {
    rateLimit: {
      max: TROCAS_DE_SENHA_POR_MINUTO,
      timeWindow: '1 minute',
      hook: 'preHandler' as const,
      keyGenerator: (request: FastifyRequest) => usuarioAtual(request).id,
    },
  };
  const bloqueioSimulado = createBloqueioSimulado({
    maxTentativas: MAX_TENTATIVAS_LOGIN,
    maxMinutos: BLOQUEIO_MAXIMO_MINUTOS,
  });
  const contaBloqueada = (minutos: number) => {
    const tempo = minutos <= 1 ? '1 minuto' : `${minutos} minutos`;
    return new AppError(
      429,
      ERROR_CODES.CONTA_BLOQUEADA,
      `Muitas tentativas sem sucesso. Por segurança, o acesso está bloqueado: tente de novo em ${tempo}. Se não foi você, avise o administrador.`,
      { minutos: Math.max(1, minutos) },
    );
  };

  app.post('/login', { config: limiteLogin }, async (request, reply) => {
    const { email, senha } = loginSchema.parse(request.body ?? {});

    const { rows } = await db.query<UsuarioLoginRow>(BUSCAR_USUARIO_LOGIN, [email]);
    const usuario = rows[0];

    // E-mail inexistente se comporta como uma conta real (mesmo tempo de resposta e o mesmo
    // bloqueio após várias tentativas): as respostas não revelam quem tem conta.
    if (!usuario) {
      await verifyAgainstDummy(senha);
      const restantes = bloqueioSimulado.minutosRestantes(email);
      if (restantes > 0) throw contaBloqueada(restantes);
      bloqueioSimulado.registrarFalha(email);
      throw credenciaisInvalidas();
    }

    if (usuario.bloqueado) {
      await verifyAgainstDummy(senha);
      throw contaBloqueada(usuario.minutos_bloqueio ?? 1);
    }

    if (!(await verifyPassword(senha, usuario.senha_hash))) {
      const falha = await db.query<{ bloqueado: boolean; minutos: number | null }>(
        REGISTRAR_FALHA_LOGIN,
        [usuario.id, MAX_TENTATIVAS_LOGIN, BLOQUEIO_MAXIMO_MINUTOS],
      );
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
          depois: { minutos: falha.rows[0]?.minutos },
          ip: request.ip,
        });
      }
      throw credenciaisInvalidas();
    }

    // Passou do prazo sem login: desativa agora, sem esperar a rotina periódica.
    if (usuario.ativo && usuario.sem_uso) {
      await desativarContasSemUso(database);
    }

    // Só informa que o usuário está desativado para quem acertou a senha.
    if (!usuario.ativo || usuario.sem_uso) {
      throw new AppError(
        403,
        ERROR_CODES.USUARIO_INATIVO,
        'Seu acesso está desativado. Fale com o administrador do sistema.',
      );
    }

    const sucesso = await db.query<{ falhas_desde_ultimo_login: number }>(REGISTRAR_LOGIN_SUCESSO, [
      usuario.id,
    ]);
    const tentativasSemSucesso = sucesso.rows[0]?.falhas_desde_ultimo_login ?? 0;
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
      trocarSenha: usuario.trocar_senha,
    };
    reply.setCookie(sessions.cookieName, token, sessions.cookieOptions);
    // Senhas erradas desde o último acesso: a pessoa é avisada (pode ser alguém tentando).
    return { usuario: sessao, tentativasSemSucesso };
  });

  app.post('/logout', async (request, reply) => {
    await sessions.revokeToken(request.cookies[sessions.cookieName]);
    reply.clearCookie(sessions.cookieName, sessions.cookieOptions);
    return reply.status(204).send();
  });

  app.get('/me', { preHandler: guards.requireSessao }, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return { usuario: usuarioAtual(request) };
  });

  app.post(
    '/alterar-senha',
    { preHandler: guards.requireSessao, config: limiteTrocaDeSenha },
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

  // A própria pessoa sai dos outros navegadores e aparelhos (ex.: celular perdido).
  app.post('/encerrar-outras-sessoes', { preHandler: guards.requireAuth }, async (request) => {
    const usuario = usuarioAtual(request);
    const sessoesEncerradas = await database.transaction(async (tx) => {
      const total = await sessions.revokeAllForUser(usuario.id, request.sessaoId, tx);
      await registrarAuditoria(tx, {
        atorId: usuario.id,
        acao: 'SESSOES_ENCERRADAS',
        entidade: 'usuario',
        entidadeId: usuario.id,
        depois: { sessoesEncerradas: total, manteveEsteAparelho: true },
        ip: request.ip,
      });
      return total;
    });
    return { sessoesEncerradas };
  });
};
