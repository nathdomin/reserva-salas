import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarUsuarioTeste, resetDatabase, SENHA_PADRAO } from '../../../test/db';
import { COOKIE_SESSAO, comSessao, createTestApp, login, TEST_ORIGIN } from '../../../test/helpers';
import { hashSessionToken } from './tokens';

describe('autenticação', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.ready();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.database.pool);
  });

  const postLogin = (email: string, senha: string) =>
    ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, senha } });

  describe('login', () => {
    it('com credenciais corretas devolve o usuário e um cookie seguro', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool, { nome: 'Ana Souza' });
      const res = await postLogin(usuario.email, usuario.senha);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        usuario: {
          id: usuario.id,
          nome: 'Ana Souza',
          email: usuario.email,
          perfil: 'COLABORADOR',
          trocarSenha: false,
        },
        tentativasSemSucesso: 0,
      });
      const cookie = res.cookies.find((c) => c.name === COOKIE_SESSAO);
      expect(cookie).toBeDefined();
      expect(cookie!.httpOnly).toBe(true);
      expect(String(cookie!.sameSite).toLowerCase()).toBe('strict');
      expect(cookie!.path).toBe('/');
      expect(res.body).not.toContain('senha');
    });

    it('aceita o e-mail com maiúsculas e espaços', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool, { email: 'bruno@empresa.com' });
      const res = await postLogin('  Bruno@Empresa.COM ', usuario.senha);
      expect(res.statusCode).toBe(200);
    });

    it('senha errada e e-mail inexistente recebem a MESMA mensagem genérica', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const senhaErrada = await postLogin(usuario.email, 'senha-errada-999');
      const emailInexistente = await postLogin('ninguem@empresa.com', 'qualquer-senha-1');

      expect(senhaErrada.statusCode).toBe(401);
      expect(emailInexistente.statusCode).toBe(401);
      expect(senhaErrada.json()).toEqual(emailInexistente.json());
      expect(senhaErrada.json().error.message).toBe('E-mail ou senha incorretos.');
      expect(senhaErrada.cookies.find((c) => c.name === COOKIE_SESSAO)).toBeUndefined();
    });

    it('valida os campos e responde em português', async () => {
      const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
      expect(res.statusCode).toBe(400);
      const campos = res.json().error.details.map((d: { campo: string }) => d.campo);
      expect(campos).toEqual(expect.arrayContaining(['email', 'senha']));
    });

    it('usuário desativado não entra, mesmo com a senha certa', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool, { ativo: false });
      const res = await postLogin(usuario.email, usuario.senha);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('USUARIO_INATIVO');
    });

    it('bloqueio progressivo: 1 minuto na 1ª série de erros, 2 na 2ª; o admin desbloqueia', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const admin = await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN' });
      const tokenAdmin = await login(ctx.app, admin);
      const errar5 = async (rodada: string) => {
        for (let i = 0; i < 5; i++) await postLogin(usuario.email, `errada-${rodada}-${i}-xx`);
      };

      await errar5('a');
      let res = await postLogin(usuario.email, usuario.senha);
      expect(res.statusCode).toBe(429);
      expect(res.json().error.details).toEqual({ minutos: 1 });

      // Simula o fim do 1º bloqueio; a 2ª série de erros bloqueia por 2 minutos.
      await ctx.database.pool.query(
        `update reserva.usuarios set bloqueado_ate = now() - interval '1 second' where id = $1`,
        [usuario.id],
      );
      await errar5('b');
      res = await postLogin(usuario.email, usuario.senha);
      expect(res.json().error.details).toEqual({ minutos: 2 });

      const desbloqueio = await ctx.app.inject({
        method: 'POST',
        url: `/api/admin/usuarios/${usuario.id}/desbloquear`,
        ...comSessao(tokenAdmin),
      });
      expect(desbloqueio.statusCode).toBe(200);
      expect(desbloqueio.json().usuario.bloqueado).toBe(false);

      // Entra, e o login avisa as 10 senhas erradas desde o acesso anterior.
      res = await postLogin(usuario.email, usuario.senha);
      expect(res.statusCode).toBe(200);
      expect(res.json().tentativasSemSucesso).toBe(10);
      const { rows } = await ctx.database.pool.query(
        `select bloqueios_seguidos from reserva.usuarios where id = $1`,
        [usuario.id],
      );
      expect(rows[0].bloqueios_seguidos).toBe(0);

      // No login seguinte, sem erros no meio, o aviso some.
      expect((await postLogin(usuario.email, usuario.senha)).json().tentativasSemSucesso).toBe(0);
    });

    it('bloqueia após 5 senhas erradas, mesmo que a 6ª esteja certa', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      for (let i = 0; i < 5; i++) {
        expect((await postLogin(usuario.email, `errada-${i}-xxxx`)).statusCode).toBe(401);
      }
      const res = await postLogin(usuario.email, usuario.senha);
      expect(res.statusCode).toBe(429);
      expect(res.json().error.code).toBe('CONTA_BLOQUEADA');

      const { rows } = await ctx.database.pool.query(
        `select acao from reserva.auditoria where entidade_id = $1 order by id`,
        [usuario.id],
      );
      const acoes = rows.map((r) => r.acao);
      expect(acoes.filter((a) => a === 'LOGIN_FALHO')).toHaveLength(5);
      expect(acoes).toContain('CONTA_BLOQUEADA');
    });

    it('e-mail inexistente responde igual a uma conta real, inclusive no bloqueio', async () => {
      const email = 'nao.existe@empresa.com';
      for (let i = 0; i < 5; i++) {
        expect((await postLogin(email, `errada-${i}-xxxx`)).statusCode).toBe(401);
      }
      const res = await postLogin(email, 'qualquer-senha-1');
      expect(res.statusCode).toBe(429);
      expect(res.json().error.code).toBe('CONTA_BLOQUEADA');
    });

    it('um login certo zera a contagem de falhas', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      for (let i = 0; i < 4; i++) await postLogin(usuario.email, `errada-${i}-xxxx`);
      expect((await postLogin(usuario.email, usuario.senha)).statusCode).toBe(200);
      for (let i = 0; i < 4; i++) await postLogin(usuario.email, `errada-${i}-yyyy`);
      expect((await postLogin(usuario.email, usuario.senha)).statusCode).toBe(200);
    });

    it('o banco guarda só o hash do token, nunca o token do cookie', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);
      const { rows } = await ctx.database.pool.query('select id from reserva.sessoes');
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(hashSessionToken(token));
      expect(rows[0].id).not.toBe(token);
    });

    it('senhas nunca aparecem na auditoria', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      await postLogin(usuario.email, 'senha-errada-999');
      const { rows } = await ctx.database.pool.query(
        `select coalesce(antes::text, '') || coalesce(depois::text, '') as dados from reserva.auditoria`,
      );
      for (const row of rows) {
        expect(row.dados).not.toContain('senha-errada-999');
        expect(row.dados).not.toContain(SENHA_PADRAO);
      }
    });
  });

  describe('sessão', () => {
    it('GET /me sem login responde 401', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me' });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('NAO_AUTENTICADO');
    });

    it('GET /me com cookie inválido ou forjado responde 401', async () => {
      for (const token of ['abc', 'x'.repeat(43), 'A'.repeat(43)]) {
        const res = await ctx.app.inject({
          method: 'GET',
          url: '/api/auth/me',
          ...comSessao(token),
        });
        expect(res.statusCode).toBe(401);
      }
    });

    it('GET /me com sessão válida devolve o usuário', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN' });
      const token = await login(ctx.app, usuario);
      const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
      expect(res.statusCode).toBe(200);
      expect(res.json().usuario).toMatchObject({ id: usuario.id, perfil: 'ADMIN' });
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('sessão expirada não é aceita', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);
      await ctx.database.pool.query(
        `update reserva.sessoes set expira_em = now() - interval '1 second'`,
      );
      const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
      expect(res.statusCode).toBe(401);
    });

    it('sessão além da duração máxima não é aceita, mesmo em uso', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);
      await ctx.database.pool.query(
        `update reserva.sessoes set criado_em = now() - interval '13 hours'`,
      );
      const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
      expect(res.statusCode).toBe(401);
    });

    it('usuário desativado perde o acesso na hora, mesmo com sessão aberta', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);
      await ctx.database.pool.query('update reserva.usuarios set ativo = false where id = $1', [
        usuario.id,
      ]);
      const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
      expect(res.statusCode).toBe(401);
    });

    it('logout encerra a sessão no servidor e limpa o cookie', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { origin: TEST_ORIGIN },
        ...comSessao(token),
      });
      expect(res.statusCode).toBe(204);
      const limpo = res.cookies.find((c) => c.name === COOKIE_SESSAO);
      expect(limpo?.value).toBe('');

      const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
      expect(me.statusCode).toBe(401);
      const { rows } = await ctx.database.pool.query(
        'select count(*)::int as n from reserva.sessoes',
      );
      expect(rows[0].n).toBe(0);
    });

    it('logout sem sessão também responde 204', async () => {
      const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout' });
      expect(res.statusCode).toBe(204);
    });

    it('login a partir de outro site é bloqueado (CSRF)', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: 'https://site-malicioso.example' },
        payload: { email: usuario.email, senha: usuario.senha },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('alterar a própria senha', () => {
    const alterar = (token: string, payload: object) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/auth/alterar-senha',
        payload,
        ...comSessao(token),
      });

    it('exige login', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/alterar-senha',
        payload: { senhaAtual: 'x', novaSenha: 'nova-senha-123' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('recusa se a senha atual estiver errada', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);
      const res = await alterar(token, {
        senhaAtual: 'errada-000000',
        novaSenha: 'nova-senha-123',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('SENHA_ATUAL_INCORRETA');
    });

    it('recusa senha nova curta', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);
      const res = await alterar(token, { senhaAtual: usuario.senha, novaSenha: 'curta' });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.details[0].campo).toBe('novaSenha');
    });

    it('troca a senha, mantém a sessão atual e encerra as outras', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const tokenAtual = await login(ctx.app, usuario);
      const tokenOutroNavegador = await login(ctx.app, usuario);

      const res = await alterar(tokenAtual, {
        senhaAtual: usuario.senha,
        novaSenha: 'minha-nova-senha-2026',
      });
      expect(res.statusCode).toBe(204);

      const me = (t: string) =>
        ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(t) });
      expect((await me(tokenAtual)).statusCode).toBe(200);
      expect((await me(tokenOutroNavegador)).statusCode).toBe(401);

      expect((await postLogin(usuario.email, usuario.senha)).statusCode).toBe(401);
      expect((await postLogin(usuario.email, 'minha-nova-senha-2026')).statusCode).toBe(200);
    });
  });
});

describe('limite de tentativas de login por IP', () => {
  it('responde 429 depois do limite configurado', async () => {
    const { app, database } = await createTestApp({ LOGIN_RATE_LIMIT_MAX: '3' });
    try {
      await resetDatabase(database.pool);
      const tentar = () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'ninguem@empresa.com', senha: 'qualquer-coisa' },
        });
      for (let i = 0; i < 3; i++) expect((await tentar()).statusCode).toBe(401);
      const res = await tentar();
      expect(res.statusCode).toBe(429);
      expect(res.json().error.code).toBe('RATE_LIMIT');
    } finally {
      await app.close();
    }
  });
});
