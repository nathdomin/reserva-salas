import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const SUPABASE_URL =
  'postgresql://postgres.abcdefgh:segredo123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

const base = {
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: SUPABASE_URL,
};

function errorOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  return '';
}

describe('parseEnv', () => {
  it('aplica valores padrão', () => {
    const env = parseEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3333);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.DATABASE_SSL).toBe('require');
    expect(env.DATABASE_POOL_MAX).toBe(5);
  });

  it('normaliza APP_ORIGIN (remove barra e caminho)', () => {
    expect(parseEnv({ ...base, APP_ORIGIN: 'https://salas.empresa.local/' }).APP_ORIGIN).toBe(
      'https://salas.empresa.local',
    );
  });

  it('converte PORT e TRUST_PROXY de texto', () => {
    const env = parseEnv({ ...base, PORT: '8080', TRUST_PROXY: '1' });
    expect(env.PORT).toBe(8080);
    expect(env.TRUST_PROXY).toBe(1);
    expect(parseEnv({ ...base, TRUST_PROXY: '10.0.0.5' }).TRUST_PROXY).toBe('10.0.0.5');
    expect(parseEnv({ ...base, TRUST_PROXY: 'loopback' }).TRUST_PROXY).toBe('loopback');
  });

  it('recusa TRUST_PROXY=true (permitiria forjar o IP pelo X-Forwarded-For)', () => {
    expect(() => parseEnv({ ...base, TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
  });

  it('em produção exige APP_ORIGIN com https (exceto localhost)', () => {
    const prod = {
      ...base,
      NODE_ENV: 'production',
      DATABASE_SSL: 'disable',
      DATABASE_URL: 'postgresql://u:s@localhost:5432/db',
    };
    expect(() => parseEnv({ ...prod, APP_ORIGIN: 'http://salas.empresa.local' })).toThrow(
      /APP_ORIGIN/,
    );
    expect(parseEnv({ ...prod, APP_ORIGIN: 'https://salas.empresa.local' }).APP_ORIGIN).toBe(
      'https://salas.empresa.local',
    );
    expect(parseEnv(prod).APP_ORIGIN).toBe('http://localhost:5173');
  });

  it('falha listando o nome da variável ausente, sem expor valores', () => {
    const message = errorOf(() =>
      parseEnv({ APP_ORIGIN: 'http://localhost:5173', OUTRA_SENHA: 'super-secreta' }),
    );
    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain('super-secreta');
  });

  it('rejeita URL de banco que não é PostgreSQL', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: 'mysql://u:p@localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('recusa o texto de exemplo no lugar da senha', () => {
    const exemplo =
      'postgresql://postgres.abc:SUA-SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
    expect(() => parseEnv({ ...base, DATABASE_URL: exemplo })).toThrow(/senha real/);
    expect(() => parseEnv({ ...base, DATABASE_URL_TEST: exemplo })).toThrow(/DATABASE_URL_TEST/);
  });

  it('exige o certificado quando DATABASE_SSL=verify-full', () => {
    expect(() => parseEnv({ ...base, DATABASE_SSL: 'verify-full' })).toThrow(/DATABASE_SSL_CA/);
    expect(() =>
      parseEnv({ ...base, DATABASE_SSL: 'verify-full', DATABASE_SSL_CA: './nao-existe.crt' }),
    ).toThrow(/não encontrado/);
  });

  it('não permite desligar o SSL para um banco na internet', () => {
    expect(() => parseEnv({ ...base, DATABASE_SSL: 'disable' })).toThrow(/própria máquina/);
  });

  it('permite desligar o SSL para um banco local', () => {
    const env = parseEnv({
      ...base,
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      DATABASE_SSL: 'disable',
    });
    expect(env.DATABASE_SSL).toBe('disable');
  });

  it('em produção exige verificação do certificado', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(/verify-full/);
  });

  it('aceita DATABASE_MIGRATION_URL opcional e recusa o texto de exemplo nela', () => {
    expect(parseEnv(base).DATABASE_MIGRATION_URL).toBeUndefined();
    const url = SUPABASE_URL.replace('postgres.abcdefgh', 'postgres.abcdefgh');
    expect(parseEnv({ ...base, DATABASE_MIGRATION_URL: url }).DATABASE_MIGRATION_URL).toBe(url);
    expect(() =>
      parseEnv({ ...base, DATABASE_MIGRATION_URL: url.replace('segredo123', 'SUA-SENHA') }),
    ).toThrow(/DATABASE_MIGRATION_URL/);
  });
});
