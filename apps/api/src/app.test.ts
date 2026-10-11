import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, TEST_ORIGIN } from '../test/helpers';

describe('API — estrutura inicial', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    // Rota auxiliar só para testar a verificação de origem em métodos que alteram dados.
    ctx.app.post('/api/__teste-origem', async () => ({ ok: true }));
    await ctx.app.ready();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/health responde 200 com o banco de teste real conectado', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('o banco de teste tem as extensões necessárias (rode npm run db:setup se falhar)', async () => {
    const { rows } = await ctx.database.pool.query<{ extname: string }>(
      "select extname from pg_extension where extname = 'btree_gist'",
    );
    expect(rows.map((r) => r.extname)).toEqual(['btree_gist']);
  });

  it('rota inexistente da API devolve 404 em JSON e em português', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
    });
  });

  it('envia cabeçalhos de segurança', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('bloqueia POST vindo de outra origem (CSRF)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/__teste-origem',
      headers: { origin: 'https://site-malicioso.example' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('bloqueia POST marcado como cross-site pelo navegador', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/__teste-origem',
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('permite POST da origem do sistema', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/__teste-origem',
      headers: { origin: TEST_ORIGIN, 'sec-fetch-site': 'same-origin' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('API — banco indisponível', () => {
  it('GET /api/health responde 503 sem vazar detalhes do erro', async () => {
    // Porta 1 da própria máquina: conexão recusada imediatamente.
    const { app } = await createTestApp({
      DATABASE_URL: 'postgresql://ninguem:x@127.0.0.1:1/inexistente',
      DATABASE_SSL: 'disable',
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe('degraded');
      expect(body.database).toBe('indisponivel');
      expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|ninguem|127\.0\.0\.1/);
    } finally {
      await app.close();
    }
  });

  it('o limite de requisições vale para a API, não para os arquivos do site', async () => {
    const { app } = await createTestApp({ RATE_LIMIT_MAX: '10' });
    try {
      for (let i = 0; i < 20; i++) {
        const res = await app.inject({ method: 'GET', url: '/assets/app.css' });
        expect(res.statusCode).not.toBe(429);
      }
      const codigos: number[] = [];
      for (let i = 0; i < 11; i++) {
        codigos.push((await app.inject({ method: 'GET', url: '/api/health' })).statusCode);
      }
      expect(
        codigos.slice(0, 10).every((c) => c === 200),
        String(codigos),
      ).toBe(true);
      expect(codigos[10]).toBe(429);
    } finally {
      await app.close();
    }
  });
});
