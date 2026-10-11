import { readFileSync } from 'node:fs';
import type { DatabaseSslMode } from '../config/env';

export interface DatabaseConnectionOptions {
  url: string;
  ssl: DatabaseSslMode;
  /** Caminho do certificado raiz (CA) do Supabase. Obrigatório com verify-full. */
  caPath?: string;
  poolMax: number;
  connectionTimeoutMs?: number;
}

export type SslConfig = false | { rejectUnauthorized: boolean; ca?: string };

export interface PoolConfig {
  connectionString: string;
  ssl: SslConfig;
  max: number;
  connectionTimeoutMillis: number;
}

/**
 * Monta a configuração do pool do `pg`.
 *
 * Parâmetros de SSL dentro da URL (ex.: `?sslmode=require`, que o Supabase às vezes inclui)
 * são removidos: no `pg` eles sobrescrevem a opção `ssl`, o que poderia desligar a
 * verificação do certificado sem ninguém perceber. A política de SSL vem só do .env.
 */
export function buildPoolConfig(
  options: DatabaseConnectionOptions,
  readFile: (path: string) => string = (p) => readFileSync(p, 'utf8'),
): PoolConfig {
  const url = new URL(options.url);
  for (const param of ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
    url.searchParams.delete(param);
  }

  let ssl: SslConfig;
  switch (options.ssl) {
    case 'verify-full':
      if (!options.caPath) throw new Error('DATABASE_SSL_CA é obrigatório com verify-full.');
      ssl = { rejectUnauthorized: true, ca: readFile(options.caPath) };
      break;
    case 'require':
      ssl = { rejectUnauthorized: false };
      break;
    case 'disable':
      ssl = false;
      break;
  }

  return {
    connectionString: url.toString(),
    ssl,
    max: options.poolMax,
    // O Supabase fica na internet: um tempo um pouco maior evita falsos "indisponível".
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 8000,
  };
}

/** Opções de conexão a partir das variáveis de ambiente já validadas. */
export function connectionOptionsFromEnv(
  env: {
    DATABASE_SSL: DatabaseSslMode;
    DATABASE_SSL_CA?: string | undefined;
    DATABASE_POOL_MAX: number;
    DATABASE_CONNECTION_TIMEOUT_MS?: number;
  },
  url: string,
): DatabaseConnectionOptions {
  return {
    url,
    ssl: env.DATABASE_SSL,
    poolMax: env.DATABASE_POOL_MAX,
    ...(env.DATABASE_CONNECTION_TIMEOUT_MS
      ? { connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS }
      : {}),
    ...(env.DATABASE_SSL_CA ? { caPath: env.DATABASE_SSL_CA } : {}),
  };
}
