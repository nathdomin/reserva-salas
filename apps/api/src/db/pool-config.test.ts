import { describe, expect, it } from 'vitest';
import { buildPoolConfig } from './pool-config';

const URL_COM_SSLMODE =
  'postgresql://postgres.abc:segredo@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require&application_name=x';

describe('buildPoolConfig', () => {
  it('verify-full: confere o certificado usando a CA informada', () => {
    const config = buildPoolConfig(
      { url: URL_COM_SSLMODE, ssl: 'verify-full', caPath: 'ca.crt', poolMax: 5 },
      (path) => `conteudo de ${path}`,
    );
    expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: 'conteudo de ca.crt' });
  });

  it('require: criptografa sem conferir o certificado', () => {
    const config = buildPoolConfig({ url: URL_COM_SSLMODE, ssl: 'require', poolMax: 5 });
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('disable: sem SSL', () => {
    const config = buildPoolConfig({
      url: 'postgresql://u:p@localhost:5432/db',
      ssl: 'disable',
      poolMax: 5,
    });
    expect(config.ssl).toBe(false);
  });

  it('remove sslmode da URL para não sobrescrever a política de SSL, mantendo o resto', () => {
    const config = buildPoolConfig({ url: URL_COM_SSLMODE, ssl: 'require', poolMax: 3 });
    expect(config.connectionString).not.toContain('sslmode');
    expect(config.connectionString).toContain('application_name=x');
    expect(config.connectionString).toContain('aws-0-sa-east-1.pooler.supabase.com:5432/postgres');
    expect(config.max).toBe(3);
  });

  it('verify-full sem certificado é um erro', () => {
    expect(() => buildPoolConfig({ url: URL_COM_SSLMODE, ssl: 'verify-full', poolMax: 5 })).toThrow(
      /DATABASE_SSL_CA/,
    );
  });
});
