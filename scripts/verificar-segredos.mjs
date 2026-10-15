// Recusa arquivos versionados que receberam uma senha real no lugar do texto de exemplo.
// Roda em "npm run check" (e pode rodar sozinho: npm run check:segredos).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Arquivo → linha que deve continuar exatamente com o texto de exemplo. */
const ARQUIVOS = [
  {
    arquivo: 'database/papel-aplicacao.sql',
    esperado: /^\s*senha text := 'TROQUE-ESTA-SENHA';/m,
    dica: "troque a senha só no SQL Editor do Supabase; aqui deve ficar 'TROQUE-ESTA-SENHA'",
  },
  {
    arquivo: 'database/papel-backup.sql',
    esperado: /^\s*senha text := 'TROQUE-ESTA-SENHA';/m,
    dica: "troque a senha só no SQL Editor do Supabase; aqui deve ficar 'TROQUE-ESTA-SENHA'",
  },
];

const problemas = ARQUIVOS.filter(({ arquivo, esperado }) => {
  const conteudo = readFileSync(path.join(raiz, arquivo), 'utf8');
  return !esperado.test(conteudo);
});

if (problemas.length > 0) {
  console.error('Possível senha real em arquivo versionado:');
  for (const { arquivo, dica } of problemas) console.error(`  - ${arquivo}: ${dica}`);
  process.exit(1);
}
console.log('Nenhuma senha real encontrada nos arquivos de exemplo.');
