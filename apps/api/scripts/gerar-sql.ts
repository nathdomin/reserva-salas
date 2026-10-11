/**
 * Gera database/supabase.sql: a estrutura completa do banco em um único script,
 * para colar no SQL Editor do Supabase.
 *
 *   npm run db:sql
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMigrations } from '../src/db/migrate';
import { gerarSqlConsolidado } from '../src/db/sql-consolidado';

export const ARQUIVO_SQL = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../database/supabase.sql',
);

const migracoes = readMigrations();
writeFileSync(ARQUIVO_SQL, gerarSqlConsolidado(migracoes));
console.log(
  `✔ ${path.relative(process.cwd(), ARQUIVO_SQL)} gerado com ${migracoes.length} migração(ões).`,
);
