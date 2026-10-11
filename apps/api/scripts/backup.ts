/**
 * Gera um backup dos dados (usuários, salas, reservas, histórico e configurações).
 *
 *   npm run db:backup                       → backups/reserva-AAAA-MM-DD-HHMM.sql
 *   npm run db:backup -- caminho/arquivo.sql
 *
 * O arquivo contém dados pessoais: guarde-o em local protegido.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { partesNoFuso } from '@reserva/shared';
import { loadEnv } from '../src/config/env';
import { gerarBackup, lerCabecalho } from '../src/db/backup';
import { createDatabase } from '../src/db/client';
import { connectionOptionsFromEnv } from '../src/db/pool-config';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pastaDoUsuario = process.env.INIT_CWD ?? process.cwd();

function nomePadrao() {
  const { data, hora } = partesNoFuso(new Date());
  return path.join(raiz, 'backups', `reserva-${data}-${hora.replace(':', '')}.sql`);
}

try {
  const env = loadEnv();
  const argumento = process.argv[2];
  const destino = argumento ? path.resolve(pastaDoUsuario, argumento) : nomePadrao();
  const database = createDatabase(connectionOptionsFromEnv(env, env.DATABASE_URL));
  const client = await database.pool.connect();
  try {
    const conteudo = await gerarBackup(client);
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo, { mode: 0o600 });
    const cab = lerCabecalho(conteudo)!;
    const linhas = Object.entries(cab.linhas)
      .map(([tabela, n]) => `${tabela}: ${n}`)
      .join(', ');
    console.log(`✔ Backup salvo em ${destino}`);
    console.log(`  ${linhas}`);
    console.log('  Contém dados pessoais: guarde em local protegido.');
  } finally {
    client.release();
    await database.close();
  }
} catch (error) {
  console.error(`✖ Não foi possível gerar o backup: ${(error as Error).message}`);
  process.exit(1);
}
