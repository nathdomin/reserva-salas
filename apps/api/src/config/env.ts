import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Textos de exemplo que indicam que a senha real ainda não foi colocada no .env. */
const PASSWORD_PLACEHOLDERS = ['SUA-SENHA', '[YOUR-PASSWORD]'];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Quais proxies reversos são confiáveis para ler o IP real (X-Forwarded-For):
 *  - false (padrão): nenhum; o IP é o da conexão.
 *  - número: quantos proxies há na frente da API (ex.: 1 para um Nginx/Caddy).
 *  - IPs/faixas separados por vírgula, ou "loopback" (proxy na mesma máquina).
 * "true" não é aceito: confiaria em qualquer valor enviado pelo cliente, que poderia
 * forjar o IP e escapar do limite de tentativas de login.
 */
const trustProxy = z
  .string()
  .trim()
  .default('false')
  .refine((v) => v !== 'true', 'use o número de proxies (ex.: 1) ou o IP do proxy, e não "true"')
  .transform((v): false | number | string => {
    if (v === '' || v === 'false') return false;
    if (/^\d+$/.test(v)) return Number(v);
    return v;
  });

const postgresUrl = z
  .string()
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'deve começar com postgresql://');

/**
 * SSL da conexão com o banco:
 *  - verify-full: criptografa E confere o certificado do servidor (exige DATABASE_SSL_CA).
 *  - require:     criptografa, mas não confere o servidor. Aceito só fora de produção.
 *  - disable:     sem SSL. Aceito só para banco na própria máquina.
 */
export const DATABASE_SSL_MODES = ['verify-full', 'require', 'disable'] as const;
export type DatabaseSslMode = (typeof DATABASE_SSL_MODES)[number];

function isLocalDatabase(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    APP_ORIGIN: z
      .string()
      .url()
      .transform((value) => new URL(value).origin),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    TRUST_PROXY: trustProxy,
    DATABASE_URL: postgresUrl,
    DATABASE_URL_TEST: postgresUrl.optional(),
    // Opcional: conexão com o dono das tabelas (postgres), usada só por db:setup e db:migrate
    // quando a aplicação usa um usuário de permissões mínimas (database/papel-aplicacao.sql).
    DATABASE_MIGRATION_URL: postgresUrl.optional(),
    DATABASE_SSL: z.enum(DATABASE_SSL_MODES).default('require'),
    DATABASE_SSL_CA: z.string().min(1).optional(),
    // O pooler gratuito do Supabase aceita poucas conexões simultâneas por projeto.
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    // Tempo máximo esperando uma conexão livre do pool (ms).
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(8000),
    // Sessão: encerra após este tempo sem uso...
    SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(480),
    // ...e, em qualquer caso, após este tempo desde o login.
    SESSION_MAX_HOURS: z.coerce.number().int().min(1).max(168).default(12),
    // Requisições à API por minuto, por sessão (sem sessão, por endereço IP).
    RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(100_000).default(600),
    // Tentativas de login por minuto, por endereço IP. Comporta um escritório inteiro saindo
    // por um único IP; cada conta já tem o próprio bloqueio após 5 senhas erradas.
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(30),
  })
  .superRefine((env, ctx) => {
    const issue = (pathName: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [pathName], message });

    for (const key of ['DATABASE_URL', 'DATABASE_URL_TEST', 'DATABASE_MIGRATION_URL'] as const) {
      const url = env[key];
      if (url && PASSWORD_PLACEHOLDERS.some((p) => url.includes(p))) {
        issue(key, 'substitua o texto de exemplo pela senha real do banco');
      }
    }

    if (env.SESSION_IDLE_MINUTES > env.SESSION_MAX_HOURS * 60) {
      issue('SESSION_IDLE_MINUTES', 'não pode ser maior que SESSION_MAX_HOURS');
    }

    if (env.DATABASE_SSL === 'verify-full') {
      if (!env.DATABASE_SSL_CA) {
        issue('DATABASE_SSL_CA', 'informe o caminho do certificado para usar verify-full');
      } else if (!existsSync(env.DATABASE_SSL_CA)) {
        issue('DATABASE_SSL_CA', 'arquivo do certificado não encontrado');
      }
    }

    if (
      env.DATABASE_SSL === 'disable' &&
      (!isLocalDatabase(env.DATABASE_URL) ||
        (env.DATABASE_MIGRATION_URL && !isLocalDatabase(env.DATABASE_MIGRATION_URL)))
    ) {
      issue('DATABASE_SSL', 'SSL só pode ser desligado para um banco na própria máquina');
    }

    if (env.NODE_ENV === 'production') {
      const origem = new URL(env.APP_ORIGIN);
      if (origem.protocol !== 'https:' && !LOCAL_HOSTS.has(origem.hostname)) {
        issue(
          'APP_ORIGIN',
          'em produção o endereço deve usar https:// (o cookie de sessão só trafega com HTTPS)',
        );
      }
    }

    if (env.NODE_ENV === 'production' && env.DATABASE_SSL === 'require') {
      issue(
        'DATABASE_SSL',
        'em produção use verify-full com o certificado do Supabase (DATABASE_SSL_CA)',
      );
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Valida as variáveis de ambiente. Lança um erro legível (em pt-BR) listando apenas
 * os NOMES das variáveis com problema — nunca os valores, que podem conter segredos.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Configuração inválida. Verifique o arquivo .env (veja .env.example):\n${problems}`,
    );
  }
  return result.data;
}

/**
 * Caminhos relativos no .env (ex.: DATABASE_SSL_CA=certs/supabase-ca.crt) são relativos à
 * raiz do projeto, e não à pasta de onde o comando foi executado.
 */
function resolvePathsFromRoot(root: string) {
  const ca = process.env.DATABASE_SSL_CA;
  if (ca && !path.isAbsolute(ca)) process.env.DATABASE_SSL_CA = path.resolve(root, ca);
}

function isRepoRoot(dir: string): boolean {
  const pkg = path.join(dir, 'package.json');
  if (!existsSync(pkg)) return false;
  try {
    return 'workspaces' in JSON.parse(readFileSync(pkg, 'utf8'));
  } catch {
    return false;
  }
}

/** Raiz do projeto: a pasta cujo package.json declara "workspaces", subindo a partir deste arquivo. */
function findRepoRoot(): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (isRepoRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Carrega o .env da raiz do projeto (funciona tanto em src/ quanto em dist/), ou o arquivo
 * indicado em ENV_FILE (ex.: um .env separado para testar a restauração de backups).
 * Variáveis já definidas no ambiente têm prioridade sobre o arquivo.
 */
export function loadEnvFile(): string | null {
  const root = findRepoRoot();
  let loaded: string | null = null;
  const explicit = process.env.ENV_FILE;
  if (explicit) {
    loaded = path.resolve(process.env.INIT_CWD ?? process.cwd(), explicit);
    process.loadEnvFile(loaded);
  } else if (root && existsSync(path.join(root, '.env'))) {
    loaded = path.join(root, '.env');
    process.loadEnvFile(loaded);
  }
  if (root) resolvePathsFromRoot(root);
  return loaded;
}

export function loadEnv(): Env {
  loadEnvFile();
  return parseEnv(process.env);
}
