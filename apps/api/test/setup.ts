import { loadEnvFile } from '../src/config/env';

// Carrega o .env da raiz e redireciona a API para o banco de TESTE.
loadEnvFile();

const mainUrl = process.env.DATABASE_URL;
const testUrl = process.env.DATABASE_URL_TEST;

if (!testUrl) {
  throw new Error(
    'Defina DATABASE_URL_TEST no .env (um projeto do Supabase só para testes) para rodar os testes da API.',
  );
}

// Proteção: a partir da Etapa 3 os testes apagam e recriam dados. Eles nunca podem
// rodar no banco principal, onde ficam as reservas reais.
function sameDatabase(a: string, b: string) {
  const x = new URL(a);
  const y = new URL(b);
  return (
    x.hostname === y.hostname &&
    (x.port || '5432') === (y.port || '5432') &&
    decodeURIComponent(x.username) === decodeURIComponent(y.username) &&
    x.pathname === y.pathname
  );
}

const migrationUrl = process.env.DATABASE_MIGRATION_URL;
if (
  (mainUrl && sameDatabase(mainUrl, testUrl)) ||
  (migrationUrl && sameDatabase(migrationUrl, testUrl))
) {
  throw new Error(
    'DATABASE_URL_TEST aponta para o mesmo banco que DATABASE_URL. Use um projeto do Supabase separado para os testes.',
  );
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testUrl;
// Os testes nunca usam a conexão de migração do banco principal.
delete process.env.DATABASE_MIGRATION_URL;
process.env.APP_ORIGIN ??= 'http://localhost:5173';
