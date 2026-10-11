// Gera a versão de produção da API em apps/api/dist com esbuild:
//   dist/server.js        servidor
//   dist/migrate.js       aplica migrações       (node dist/migrate.js)
//   dist/admin-create.js  cria administrador     (node dist/admin-create.js)
//   dist/db-setup.js      prepara extensões      (node dist/db-setup.js)
//   dist/backup.js        backup dos dados       (node dist/backup.js)
//   dist/restaurar.js     restaura um backup     (node dist/restaurar.js arquivo.sql)
//   dist/migrations/      arquivos SQL
// O pacote interno @reserva/shared (TypeScript) é embutido; as demais dependências
// continuam em node_modules.
import { cpSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const outdir = path.join(root, 'dist');

const external = Object.keys(pkg.dependencies ?? {}).filter((name) => name !== '@reserva/shared');

rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints: {
    server: path.join(root, 'src/server.ts'),
    migrate: path.join(root, 'scripts/migrate.ts'),
    'admin-create': path.join(root, 'scripts/admin-create.ts'),
    'db-setup': path.join(root, 'scripts/db-setup.ts'),
    backup: path.join(root, 'scripts/backup.ts'),
    restaurar: path.join(root, 'scripts/restaurar.ts'),
  },
  outdir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: [...external, ...external.map((name) => `${name}/*`)],
  logLevel: 'info',
});

cpSync(path.join(root, 'src/db/migrations'), path.join(outdir, 'migrations'), { recursive: true });
console.log('Migrações copiadas para dist/migrations');
