import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ERROR_CODES } from '@reserva/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Env } from './config/env';
import type { Database } from './db/client';
import { auditoriaRoutes, createAuditoriaService } from './modules/audit/routes';
import { createAuthGuards } from './modules/auth/guards';
import { authRoutes } from './modules/auth/routes';
import { createSessionService } from './modules/auth/session';
import { adminConfiguracoesRoutes } from './modules/configuracoes/routes';
import { createConfiguracoesCache } from './modules/configuracoes/cache';
import { createConfiguracoesService } from './modules/configuracoes/service';
import { healthRoutes } from './modules/health/routes';
import { configuracoesRoutes, reservasRoutes } from './modules/reservas/routes';
import { carregarConfiguracoes, createReservasService } from './modules/reservas/service';
import { adminSalasRoutes, salasRoutes } from './modules/salas/routes';
import { createSalasService } from './modules/salas/service';
import { usersRoutes } from './modules/users/routes';
import { createUsersService, desativarContasSemUso } from './modules/users/service';
import { registerErrorHandling, sendError } from './plugins/errors';
import { registerOriginCheck } from './plugins/origin-check';

export interface AppDeps {
  env: Env;
  database: Database;
}

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'test') return false;
  return {
    level: env.LOG_LEVEL,
    // Nunca registrar cookies, cabeçalhos de autenticação ou senhas.
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        '*.password',
        '*.senha',
        '*.senhaAtual',
        '*.novaSenha',
      ],
      censor: '[oculto]',
    },
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } } }
      : {}),
  };
}

/** Pasta do frontend compilado (apps/web/dist), resolvida a partir de src/ ou dist/. */
function webDistDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../web/dist');
}

export async function buildApp({ env, database }: AppDeps) {
  const app = Fastify({
    logger: loggerOptions(env),
    trustProxy:
      typeof env.TRUST_PROXY === 'number'
        ? // Número de proxies: confia só nos N saltos mais próximos da API.
          (_endereco: string, salto: number) => salto < (env.TRUST_PROXY as number)
        : env.TRUST_PROXY,
    bodyLimit: 100 * 1024,
  });

  registerErrorHandling(app);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        // Sem HTTPS em desenvolvimento; o proxy reverso cuida disso em produção.
        upgradeInsecureRequests: null,
      },
    },
    hsts: env.NODE_ENV === 'production',
  });

  await app.register(cookie);
  app.decorateRequest('usuario', null);
  app.decorateRequest('sessaoId', null);

  const sessions = createSessionService(database.pool, {
    idleMinutes: env.SESSION_IDLE_MINUTES,
    maxHours: env.SESSION_MAX_HOURS,
    // Em produção o sistema roda atrás de HTTPS: o cookie nunca trafega sem criptografia.
    secureCookie: env.NODE_ENV === 'production',
  });
  const guards = createAuthGuards(sessions);

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: sessions.rateLimitKey,
    // Só a API conta no limite. Arquivos do site (JS, CSS, fontes) não: uma única abertura
    // de página baixa vários deles, e o navegador os guarda em cache.
    allowList: (request) => !request.url.startsWith('/api/'),
  });

  registerOriginCheck(app, env.APP_ORIGIN);

  // Respostas da API nunca ficam em cache (dados pessoais e de reservas mudam a todo momento).
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/') && !reply.hasHeader('cache-control')) {
      reply.header('cache-control', 'no-store');
    }
  });

  // Tarefas de hora em hora (e uma vez ao iniciar): limpar sessões expiradas (além da limpeza
  // a cada login) e desativar contas sem uso (além da verificação no próprio login).
  if (env.NODE_ENV !== 'test') {
    const tarefas = () => {
      sessions.cleanupExpired().catch((err: unknown) => {
        app.log.warn({ err }, 'falha ao limpar sessões expiradas');
      });
      desativarContasSemUso(database)
        .then((total) => {
          if (total > 0) app.log.warn(`${total} conta(s) desativada(s) por falta de uso.`);
        })
        .catch((err: unknown) => {
          app.log.warn({ err }, 'falha ao desativar contas sem uso');
        });
    };
    const inicial = setTimeout(tarefas, 10_000);
    const periodica = setInterval(tarefas, 60 * 60_000);
    inicial.unref();
    periodica.unref();
    app.addHook('onClose', async () => {
      clearTimeout(inicial);
      clearInterval(periodica);
    });
  }
  const users = createUsersService(database);
  const salas = createSalasService(database);
  // Configurações em memória por 1 minuto (nos testes, sempre lidas do banco).
  const cacheConfiguracoes = createConfiguracoesCache(() => carregarConfiguracoes(database.pool), {
    ttlMs: env.NODE_ENV === 'test' ? 0 : 60_000,
  });
  const reservas = createReservasService(database, { configuracoes: cacheConfiguracoes.obter });
  const configuracoes = createConfiguracoesService(database, {
    aoAlterar: cacheConfiguracoes.invalidar,
  });
  const auditoria = createAuditoriaService(database);

  await app.register(healthRoutes, { prefix: '/api', database });
  await app.register(authRoutes, {
    prefix: '/api/auth',
    database,
    sessions,
    guards,
    loginRateLimitMax: env.LOGIN_RATE_LIMIT_MAX,
  });
  await app.register(usersRoutes, { prefix: '/api/admin/usuarios', guards, users });
  await app.register(salasRoutes, { prefix: '/api/salas', guards, salas });
  await app.register(adminSalasRoutes, { prefix: '/api/admin/salas', guards, salas });
  await app.register(reservasRoutes, { prefix: '/api/reservas', guards, reservas });
  await app.register(configuracoesRoutes, { prefix: '/api', guards, reservas });
  await app.register(adminConfiguracoesRoutes, {
    prefix: '/api/admin/configuracoes',
    guards,
    configuracoes,
  });
  await app.register(auditoriaRoutes, { prefix: '/api/admin/auditoria', guards, auditoria });

  const webDir = webDistDir();
  const serveWeb = env.NODE_ENV === 'production' && existsSync(path.join(webDir, 'index.html'));

  if (serveWeb) {
    await app.register(fastifyStatic, {
      root: webDir,
      wildcard: false,
      index: false,
      // Arquivos em /assets têm o conteúdo no nome (gerados pelo build): podem ficar em cache.
      setHeaders: (reply, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          reply.header('cache-control', 'public, max-age=31536000, immutable');
        }
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url === '/api' || request.url.startsWith('/api/');
    if (!isApi && serveWeb && (request.method === 'GET' || request.method === 'HEAD')) {
      // SPA: qualquer rota do frontend devolve o index.html.
      return reply
        .header('cache-control', 'no-cache')
        .sendFile('index.html', { cacheControl: false });
    }
    return sendError(reply, 404, ERROR_CODES.NOT_FOUND, 'Recurso não encontrado.');
  });

  return app;
}
