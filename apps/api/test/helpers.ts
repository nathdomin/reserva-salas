import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { parseEnv } from '../src/config/env';
import { createDatabase, type Database } from '../src/db/client';
import { connectionOptionsFromEnv } from '../src/db/pool-config';
import type { UsuarioTeste } from './db';

export const TEST_ORIGIN = 'http://localhost:5173';
export const COOKIE_SESSAO = 'reserva_sessao';

/**
 * Monta a aplicação apontando para o banco de teste real.
 * `overrides` permite simular outra configuração (ex.: banco inacessível).
 */
export async function createTestApp(overrides: Record<string, string> = {}) {
  const env = parseEnv({
    ...process.env,
    NODE_ENV: 'test',
    APP_ORIGIN: TEST_ORIGIN,
    // Os testes fazem muitos logins seguidos; o limite por IP é testado à parte.
    LOGIN_RATE_LIMIT_MAX: '1000',
    RATE_LIMIT_MAX: '100000',
    // O teste de 20 reservas simultâneas espera na fila do pool.
    DATABASE_CONNECTION_TIMEOUT_MS: '60000',
    ...overrides,
  });
  const database: Database = createDatabase(connectionOptionsFromEnv(env, env.DATABASE_URL));
  const app = await buildApp({ env, database });
  app.addHook('onClose', async () => {
    await database.close();
  });
  return { app, database, env };
}

/** Faz login e devolve o valor do cookie de sessão. */
export async function login(
  app: FastifyInstance,
  usuario: Pick<UsuarioTeste, 'email' | 'senha'>,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: usuario.email, senha: usuario.senha },
  });
  if (res.statusCode !== 200) {
    throw new Error(`login falhou (${res.statusCode}): ${res.body}`);
  }
  const cookie = res.cookies.find((c) => c.name === COOKIE_SESSAO);
  if (!cookie) throw new Error('login não devolveu o cookie de sessão');
  return cookie.value;
}

/** Opções de inject autenticadas com o cookie de sessão. */
export function comSessao(token: string) {
  return { cookies: { [COOKIE_SESSAO]: token } };
}
