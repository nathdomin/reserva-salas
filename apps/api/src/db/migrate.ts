import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

/**
 * Pasta das migrações. Em desenvolvimento: src/db/migrations.
 * No build de produção o script copia a pasta para dist/migrations, ao lado dos .js.
 */
export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Número fixo para o lock que impede duas execuções simultâneas de migração. */
export const MIGRATION_LOCK_ID = 727_301;

export interface MigrationFile {
  nome: string;
  sql: string;
  checksum: string;
}

export interface MigrationResult {
  aplicadas: string[];
  jaAplicadas: string[];
}

/** Lê os arquivos NNNN_nome.sql em ordem. Quebras de linha são normalizadas (Windows/Linux). */
export function readMigrations(dir = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort()
    .map((nome) => {
      const sql = readFileSync(path.join(dir, nome), 'utf8').replace(/\r\n/g, '\n');
      return { nome, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

/**
 * Aplica as migrações pendentes, cada uma em sua própria transação.
 * - Seguro para rodar várias vezes (só aplica o que falta).
 * - Recusa continuar se uma migração já aplicada foi alterada depois (checksum diferente).
 */
export async function runMigrations(
  pool: pg.Pool,
  options: { dir?: string; log?: (message: string) => void } = {},
): Promise<MigrationResult> {
  const log = options.log ?? (() => undefined);
  const files = readMigrations(options.dir);
  const client = await pool.connect();
  const result: MigrationResult = { aplicadas: [], jaAplicadas: [] };

  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);

    await client.query(`
      create schema if not exists reserva;
      create table if not exists reserva.migracoes (
        nome        text primary key,
        checksum    text not null,
        aplicada_em timestamptz not null default now()
      );
      alter table reserva.migracoes enable row level security;
    `);

    const { rows } = await client.query<{ nome: string; checksum: string }>(
      'select nome, checksum from reserva.migracoes',
    );
    const applied = new Map(rows.map((row) => [row.nome, row.checksum]));

    for (const file of files) {
      const checksum = applied.get(file.nome);
      if (checksum !== undefined) {
        if (checksum !== file.checksum) {
          throw new Error(
            `A migração ${file.nome} foi alterada depois de aplicada. ` +
              'Migrações aplicadas não podem ser editadas: crie uma nova migração.',
          );
        }
        result.jaAplicadas.push(file.nome);
        continue;
      }

      try {
        await client.query('begin');
        await client.query('set local search_path to reserva, extensions, public');
        await client.query(file.sql);
        await client.query('insert into reserva.migracoes (nome, checksum) values ($1, $2)', [
          file.nome,
          file.checksum,
        ]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw new Error(`Falha ao aplicar a migração ${file.nome}: ${(error as Error).message}`, {
          cause: error,
        });
      }
      result.aplicadas.push(file.nome);
      log(`aplicada: ${file.nome}`);
    }

    return result;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

/** Lista migrações ainda não aplicadas (usado para avisar ao iniciar o servidor). */
export async function pendingMigrations(pool: pg.Pool, dir?: string): Promise<string[]> {
  const files = readMigrations(dir);
  const exists = await pool.query<{ existe: boolean }>(
    "select to_regclass('reserva.migracoes') is not null as existe",
  );
  if (!exists.rows[0]?.existe) return files.map((f) => f.nome);
  const { rows } = await pool.query<{ nome: string }>('select nome from reserva.migracoes');
  const applied = new Set(rows.map((r) => r.nome));
  return files.filter((f) => !applied.has(f.nome)).map((f) => f.nome);
}
