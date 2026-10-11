import { buildApp } from './app';
import { loadEnv, type Env } from './config/env';
import { createDatabase } from './db/client';
import { pendingMigrations } from './db/migrate';
import { connectionOptionsFromEnv } from './db/pool-config';

let env: Env;
try {
  env = loadEnv();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const database = createDatabase(connectionOptionsFromEnv(env, env.DATABASE_URL));
const app = await buildApp({ env, database });

if (env.DATABASE_SSL === 'require') {
  app.log.warn(
    'Conexão com o banco criptografada, mas sem verificar o certificado do servidor. Para produção, use DATABASE_SSL=verify-full com DATABASE_SSL_CA (veja docs/INSTALACAO.md).',
  );
}
app.addHook('onClose', async () => {
  await database.close();
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`Recebido ${signal}. Encerrando...`);
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'falha ao encerrar');
    process.exit(1);
  }
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error({ err: error }, 'não foi possível iniciar o servidor');
  process.exit(1);
}

try {
  await database.ping();
  app.log.info('Conexão com o banco de dados OK.');
  const pendentes = await pendingMigrations(database.pool);
  if (pendentes.length > 0) {
    app.log.warn(
      `Há ${pendentes.length} migração(ões) do banco pendente(s): ${pendentes.join(', ')}. Rode: npm run db:migrate`,
    );
  }
} catch {
  app.log.warn(
    'Banco de dados indisponível. Confira o DATABASE_URL no .env e se o projeto do Supabase está ativo (projetos gratuitos pausam após 7 dias sem uso).',
  );
}
