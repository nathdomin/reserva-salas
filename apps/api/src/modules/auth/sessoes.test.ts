import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarUsuarioTeste, resetDatabase, type UsuarioTeste } from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

describe('desconectar de todos os aparelhos', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: UsuarioTeste;
  let tokenAdmin: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.ready();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.database.pool);
    admin = await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN' });
    tokenAdmin = await login(ctx.app, admin);
  });

  const me = (token: string) =>
    ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });

  it('o administrador desconecta alguém de todos os aparelhos, sem desativar a conta', async () => {
    const pessoa = await criarUsuarioTeste(ctx.database.pool);
    const celular = await login(ctx.app, pessoa);
    const notebook = await login(ctx.app, pessoa);

    const lista = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/usuarios',
      ...comSessao(tokenAdmin),
    });
    const linha = lista.json().usuarios.find((u: { id: string }) => u.id === pessoa.id);
    expect(linha.sessoesAbertas).toBe(2);

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/usuarios/${pessoa.id}/encerrar-sessoes`,
      ...comSessao(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sessoesEncerradas: 2 });
    expect((await me(celular)).statusCode).toBe(401);
    expect((await me(notebook)).statusCode).toBe(401);
    // Continua ativa: entra de novo com a senha.
    await login(ctx.app, pessoa);

    const propria = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/usuarios/${admin.id}/encerrar-sessoes`,
      ...comSessao(tokenAdmin),
    });
    expect(propria.statusCode).toBe(409);
  });

  it('a própria pessoa sai dos outros aparelhos e continua neste', async () => {
    const pessoa = await criarUsuarioTeste(ctx.database.pool);
    const este = await login(ctx.app, pessoa);
    const outro = await login(ctx.app, pessoa);

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/encerrar-outras-sessoes',
      ...comSessao(este),
    });
    expect(res.json()).toEqual({ sessoesEncerradas: 1 });
    expect((await me(este)).statusCode).toBe(200);
    expect((await me(outro)).statusCode).toBe(401);
  });
});
