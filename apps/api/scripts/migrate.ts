/**
 * Aplica as migrações pendentes no banco principal e, se definido, no banco de testes.
 *
 *   npm run db:migrate
 */
import { loadEnv } from '../src/config/env';
import { createDatabase } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { connectionOptionsFromEnv } from '../src/db/pool-config';

async function migrate(label: string, url: string) {
  const env = loadEnv();
  const database = createDatabase(connectionOptionsFromEnv(env, url));
  try {
    const result = await runMigrations(database.pool, {
      log: (message) => console.log(`  ${message}`),
    });
    const total = result.aplicadas.length + result.jaAplicadas.length;
    console.log(
      result.aplicadas.length > 0
        ? `✔ ${label}: ${result.aplicadas.length} migração(ões) aplicada(s); ${total} no total.`
        : `✔ ${label}: já estava atualizado (${total} migração(ões)).`,
    );
  } finally {
    await database.close();
  }
}

try {
  const env = loadEnv();
  // Com DATABASE_MIGRATION_URL, as migrações rodam como dono das tabelas (postgres).
  await migrate('Banco principal', env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL);
  if (env.DATABASE_URL_TEST) await migrate('Banco de testes', env.DATABASE_URL_TEST);
} catch (error) {
  console.error(`✖ ${(error as Error).message}`);
  process.exit(1);
}
