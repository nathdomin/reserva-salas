import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarUsuarioTeste, resetDatabase, type UsuarioTeste } from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

describe('troca de senha obrigatória no primeiro acesso', () => {
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

  const get = (url: string, token: string) =>
    ctx.app.inject({ method: 'GET', url, ...comSessao(token) });

  async function criarPeloAdmin() {
    const dados = {
      nome: 'Nova Pessoa',
      email: 'nova.pessoa@empresa.com',
      senha: 'senha-do-admin-1',
    };
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/usuarios',
      payload: dados,
      ...comSessao(tokenAdmin),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().usuario.trocarSenha).toBe(true);
    return { id: res.json().usuario.id as string, email: dados.email, senha: dados.senha };
  }

  it('conta criada pelo admin: só /me e a troca funcionam até escolher a própria senha', async () => {
    const pessoa = await criarPeloAdmin();
    const entrou = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: pessoa.email, senha: pessoa.senha },
    });
    expect(entrou.statusCode).toBe(200);
    expect(entrou.json().usuario.trocarSenha).toBe(true);
    const token = await login(ctx.app, pessoa);

    expect((await get('/api/auth/me', token)).json().usuario.trocarSenha).toBe(true);
    const bloqueada = await get('/api/salas', token);
    expect(bloqueada.statusCode).toBe(403);
    expect(bloqueada.json().error.code).toBe('TROCA_DE_SENHA_OBRIGATORIA');

    const troca = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/alterar-senha',
      payload: { senhaAtual: pessoa.senha, novaSenha: 'minha-propria-senha-1' },
      ...comSessao(token),
    });
    expect(troca.statusCode).toBe(204);
    expect((await get('/api/auth/me', token)).json().usuario.trocarSenha).toBe(false);
    expect((await get('/api/salas', token)).statusCode).toBe(200);
  });

  it('senha redefinida pelo admin volta a exigir a troca', async () => {
    const pessoa = await criarUsuarioTeste(ctx.database.pool);
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/usuarios/${pessoa.id}/redefinir-senha`,
      payload: { novaSenha: 'senha-temporaria-9' },
      ...comSessao(tokenAdmin),
    });
    expect(res.statusCode).toBe(204);
    const token = await login(ctx.app, { email: pessoa.email, senha: 'senha-temporaria-9' });
    expect((await get('/api/salas', token)).statusCode).toBe(403);
  });
});
