import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readMigrations } from './migrate';
import { gerarSqlConsolidado } from './sql-consolidado';

const ARQUIVO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../database/supabase.sql',
);

describe('database/supabase.sql (script único para o Supabase)', () => {
  it('está atualizado com as migrações (se falhar, rode "npm run db:sql")', () => {
    const noDisco = readFileSync(ARQUIVO, 'utf8').replace(/\r\n/g, '\n');
    expect(noDisco === gerarSqlConsolidado(readMigrations())).toBe(true);
  });

  it('registra cada migração com o mesmo checksum do "npm run db:migrate"', () => {
    const sql = gerarSqlConsolidado(readMigrations());
    for (const m of readMigrations()) {
      expect(sql).toContain(`values ('${m.nome}', '${m.checksum}')`);
    }
  });
});
