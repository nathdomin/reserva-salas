import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/helpers';
import { readMigrations, runMigrations } from './migrate';

describe('migrações', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('podem ser executadas várias vezes sem efeito colateral', async () => {
    await runMigrations(ctx.database.pool);
    const segunda = await runMigrations(ctx.database.pool);
    expect(segunda.aplicadas).toEqual([]);
    expect(segunda.jaAplicadas).toContain('0001_modelo_inicial.sql');
  });

  it('criam as tabelas no schema reserva, todas com RLS ativo', async () => {
    const { rows } = await ctx.database.pool.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'reserva' order by tablename`,
    );
    expect(rows.map((r) => r.tablename)).toEqual(
      expect.arrayContaining([
        'auditoria',
        'configuracoes',
        'reservas',
        'salas',
        'sessoes',
        'usuarios',
      ]),
    );
    expect(rows.every((r) => r.rowsecurity)).toBe(true);
  });

  it('os papéis públicos do Supabase não acessam o schema reserva', async () => {
    const { rows } = await ctx.database.pool.query<{ papel: string; usa: boolean }>(
      `select rolname as papel, has_schema_privilege(rolname, 'reserva', 'usage') as usa
         from pg_roles where rolname in ('anon', 'authenticated')`,
    );
    for (const row of rows) expect(row.usa, row.papel).toBe(false);
  });

  it('recusam continuar se uma migração aplicada foi alterada', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'migracoes-'));
    const original = readMigrations()[0]!;
    writeFileSync(path.join(dir, original.nome), `${original.sql}\n-- editada depois`);
    await expect(runMigrations(ctx.database.pool, { dir })).rejects.toThrow(/foi alterada/);
  });
});
