/**
 * Prepara o(s) banco(s) do Supabase: cria as extensões que o sistema usa.
 * Pode ser executado quantas vezes quiser (não apaga nada).
 *
 *   npm run db:setup
 *
 * Executa em DATABASE_MIGRATION_URL (ou DATABASE_URL) e, se definido, em DATABASE_URL_TEST.
 */
import { loadEnv } from '../src/config/env';
import { createDatabase } from '../src/db/client';
import { connectionOptionsFromEnv } from '../src/db/pool-config';

const SETUP_SQL = `
  -- No Supabase o schema "extensions" já existe; em outros PostgreSQL é criado aqui.
  create schema if not exists extensions;
  -- btree_gist: permite a restrição que impede duas reservas da mesma sala no mesmo horário.
  create extension if not exists btree_gist with schema extensions;
`;

function describe(url: string) {
  const { hostname, port } = new URL(url);
  return `${hostname}:${port || '5432'}`;
}

async function setup(label: string, url: string) {
  const env = loadEnv();
  const database = createDatabase(connectionOptionsFromEnv(env, url));
  try {
    await database.pool.query(SETUP_SQL);
    const { rows } = await database.pool.query<{ extname: string }>(
      "select extname from pg_extension where extname = 'btree_gist'",
    );
    console.log(
      `✔ ${label} (${describe(url)}): extensões ${rows.map((r) => r.extname).join(', ')}`,
    );
  } finally {
    await database.close();
  }
}

try {
  const env = loadEnv();
  await setup('Banco principal', env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL);
  if (env.DATABASE_URL_TEST) await setup('Banco de testes', env.DATABASE_URL_TEST);
  else console.log('ℹ DATABASE_URL_TEST não definido: banco de testes ignorado.');
} catch (error) {
  console.error(`✖ Não foi possível preparar o banco: ${(error as Error).message}`);
  process.exit(1);
}
