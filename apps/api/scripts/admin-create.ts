/**
 * Cria o primeiro administrador do sistema, de forma interativa.
 *
 *   npm run admin:create
 *   npm run admin:create -- --force   (recuperar acesso: cria outro admin ou, se o
 *                                       e-mail já existir, promove e redefine a senha)
 *
 * Não existe senha padrão: a senha é digitada aqui, sem aparecer na tela.
 */
import { createInterface } from 'node:readline/promises';
import { criarUsuarioSchema } from '@reserva/shared';
import { loadEnv } from '../src/config/env';
import { createDatabase } from '../src/db/client';
import { pendingMigrations } from '../src/db/migrate';
import { connectionOptionsFromEnv } from '../src/db/pool-config';
import { AppError } from '../src/plugins/errors';
import { AdministradorJaExisteError, criarAdministrador } from '../src/modules/users/service';

const forcar = process.argv.includes('--force');

async function perguntar(pergunta: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(pergunta)).trim();
  } finally {
    rl.close();
  }
}

/** Lê uma senha sem mostrar o que é digitado. */
function perguntarSenha(pergunta: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(pergunta);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let valor = '';

    const terminar = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', aoDigitar);
      process.stdout.write('\n');
    };

    const aoDigitar = (dados: string) => {
      for (const c of dados) {
        if (c === '\r' || c === '\n') {
          terminar();
          resolve(valor);
          return;
        }
        if (c === '\u0003') {
          // Ctrl+C
          terminar();
          console.log('Cancelado.');
          process.exit(130);
        }
        if (c === '\u007f' || c === '\b') {
          valor = valor.slice(0, -1);
          continue;
        }
        if (c >= ' ') valor += c;
      }
    };
    stdin.on('data', aoDigitar);
  });
}

function mostrarErros(issues: { path: (string | number)[]; message: string }[]) {
  for (const issue of issues) console.error(`  ✖ ${issue.message}`);
}

async function main() {
  if (!process.stdin.isTTY) {
    console.error('✖ Execute este comando diretamente em um terminal (PowerShell ou Prompt).');
    process.exit(1);
  }

  const env = loadEnv();
  const database = createDatabase(connectionOptionsFromEnv(env, env.DATABASE_URL));

  try {
    const pendentes = await pendingMigrations(database.pool);
    if (pendentes.length > 0) {
      console.error('✖ O banco ainda não está preparado. Rode antes: npm run db:migrate');
      process.exit(1);
    }

    console.log('\nCriação do administrador do MeetKof');
    if (forcar) console.log('(modo --force: recuperação de acesso)');
    console.log('');

    let dados: { nome: string; email: string; senha: string } | null = null;
    while (!dados) {
      const nome = await perguntar('Nome completo: ');
      const email = await perguntar('E-mail corporativo: ');
      const senha = await perguntarSenha('Senha (mínimo 10 caracteres): ');
      const confirmacao = await perguntarSenha('Repita a senha: ');

      if (senha !== confirmacao) {
        console.error('  ✖ As senhas não conferem. Vamos tentar de novo.\n');
        continue;
      }
      const resultado = criarUsuarioSchema.safeParse({ nome, email, senha, perfil: 'ADMIN' });
      if (!resultado.success) {
        mostrarErros(resultado.error.issues);
        console.error('  Vamos tentar de novo.\n');
        continue;
      }
      dados = resultado.data;
    }

    const { usuario, recuperado } = await criarAdministrador(database, dados, { forcar });
    console.log(
      recuperado
        ? `\n✔ Acesso recuperado: ${usuario.nome} <${usuario.email}> agora é administrador, com a nova senha.`
        : `\n✔ Administrador criado: ${usuario.nome} <${usuario.email}>.`,
    );
    console.log('  Entre no sistema com este e-mail e a senha que você digitou.');
  } catch (error) {
    if (error instanceof AdministradorJaExisteError) {
      console.error(
        '✖ Já existe um administrador ativo. Novos usuários são criados pela tela Usuários.\n' +
          '  Se perdeu o acesso de administrador, use: npm run admin:create -- --force',
      );
    } else if (error instanceof AppError) {
      console.error(`✖ ${error.message}`);
      if (error.code === 'EMAIL_EM_USO') {
        console.error('  Para dar acesso de administrador a esse usuário, use --force.');
      }
    } else {
      console.error(`✖ Não foi possível criar o administrador: ${(error as Error).message}`);
    }
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}

await main();
