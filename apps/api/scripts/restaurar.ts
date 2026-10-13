/**
 * Restaura um backup gerado por "npm run db:backup".
 *
 *   npm run db:restaurar -- backups/arquivo.sql               (banco sem dados)
 *   npm run db:restaurar -- backups/arquivo.sql --substituir  (APAGA os dados atuais antes)
 *
 * A estrutura precisa existir (npm run db:migrate ou database/supabase.sql).
 * Usa DATABASE_MIGRATION_URL, se definida (precisa de permissão para apagar dados).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { loadEnv } from '../src/config/env';
import { lerCabecalho, RestauracaoRecusada, restaurarBackup } from '../src/db/backup';
import { createDatabase } from '../src/db/client';
import { connectionOptionsFromEnv } from '../src/db/pool-config';

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith('--'));
const substituir = args.includes('--substituir');
const confirmado = args.includes('--sim');

async function confirmar(pergunta: string): Promise<boolean> {
  if (confirmado) return true;
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(pergunta)).trim() === 'SUBSTITUIR';
  } finally {
    rl.close();
  }
}

try {
  if (!arquivo) throw new Error('Informe o arquivo: npm run db:restaurar -- backups/arquivo.sql');
  const caminho = path.resolve(process.env.INIT_CWD ?? process.cwd(), arquivo);
  const conteudo = readFileSync(caminho, 'utf8');
  const cab = lerCabecalho(conteudo.replace(/\r\n/g, '\n'));
  if (!cab) throw new Error('O arquivo não é um backup do sistema MeetKof.');

  const env = loadEnv();
  // No pooler do Supabase o host é o mesmo para todos os projetos da região: o que identifica
  // o projeto é o usuário ("postgres.<id-do-projeto>"). A senha nunca é exibida.
  const destino = new URL(env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL);
  console.log(`Backup de ${cab.geradoEm}: ${JSON.stringify(cab.linhas)}`);
  console.log(
    `Destino: usuário ${decodeURIComponent(destino.username)} em ${destino.hostname}${destino.pathname}`,
  );
  if (
    substituir &&
    !(await confirmar('Os dados ATUAIS serão apagados. Digite SUBSTITUIR para continuar: '))
  ) {
    console.log('Cancelado. Nada foi alterado.');
    process.exit(1);
  }

  const database = createDatabase(
    connectionOptionsFromEnv(env, env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL),
  );
  const client = await database.pool.connect();
  try {
    await restaurarBackup(client, conteudo, { substituir });
    console.log('✔ Backup restaurado. Todos precisarão entrar novamente no sistema.');
  } finally {
    client.release();
    await database.close();
  }
} catch (error) {
  const prefixo = error instanceof RestauracaoRecusada ? '✖ Restauração recusada' : '✖ Falha';
  console.error(`${prefixo}: ${(error as Error).message}`);
  process.exit(1);
}
