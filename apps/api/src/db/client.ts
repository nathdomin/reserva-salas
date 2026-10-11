import pg from 'pg';
import { buildPoolConfig, type DatabaseConnectionOptions } from './pool-config';

/** Qualquer coisa que execute SQL: o pool ou um cliente dentro de uma transação. */
export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>;
}

export interface Database {
  pool: pg.Pool;
  /** Executa uma consulta trivial para confirmar que o banco responde. */
  ping(): Promise<void>;
  /** Executa `fn` dentro de uma transação (commit no sucesso, rollback em qualquer erro). */
  transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// timestamptz chega como Date (padrão do pg). bigint (OID 20) chega como texto por padrão;
// os únicos bigint do sistema são ids de auditoria e contagens, que cabem em number.
pg.types.setTypeParser(20, (value) => Number.parseInt(value, 10));

export function createDatabase(options: DatabaseConnectionOptions): Database {
  const config = buildPoolConfig(options);

  const pool = new pg.Pool({
    ...config,
    idleTimeoutMillis: 30_000,
    // Garante que nenhuma consulta fique presa indefinidamente.
    statement_timeout: 15_000,
    application_name: 'reserva-salas-api',
  });

  // Sem este listener, um erro em uma conexão ociosa (ex.: banco reiniciado)
  // derrubaria o processo inteiro.
  pool.on('error', (error) => {
    console.error('[db] erro em conexão ociosa do pool:', error.message);
  });

  return {
    pool,
    async ping() {
      await pool.query('select 1');
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(client);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

/** Códigos de erro do PostgreSQL usados pela aplicação. */
export const PG_ERROR = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
} as const;

export function isPgError(error: unknown, code: string, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: unknown; constraint?: unknown };
  return e.code === code && (constraint === undefined || e.constraint === constraint);
}
