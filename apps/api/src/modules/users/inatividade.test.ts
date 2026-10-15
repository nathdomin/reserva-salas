import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarUsuarioTeste, resetDatabase, type UsuarioTeste } from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';
import { desativarContasSemUso } from './service';

describe('desativação automática de contas sem uso', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: UsuarioTeste;

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
  });

  /** Faz a conta parecer criada (e com último login) há `dias` dias. */
  async function semUsoHa(usuario: UsuarioTeste, dias: number) {
    await ctx.database.pool.query(
      `update reserva.usuarios
          set ativado_em = now() - make_interval(days => $2::int),
              ultimo_login_em = now() - make_interval(days => $2::int)
        where id = $1`,
      [usuario.id, dias],
    );
  }

  const ativo = async (usuario: UsuarioTeste) =>
    (
      await ctx.database.pool.query<{ ativo: boolean }>(
        'select ativo from reserva.usuarios where id = $1',
        [usuario.id],
      )
    ).rows[0]!.ativo;

  it('desativa colaborador acima do prazo, encerra as sessões e registra no histórico', async () => {
    const antigo = await criarUsuarioTeste(ctx.database.pool);
    const recente = await criarUsuarioTeste(ctx.database.pool);
    const token = await login(ctx.app, antigo);
    await semUsoHa(antigo, 61);
    await semUsoHa(recente, 59);

    expect(await desativarContasSemUso(ctx.database)).toBe(1);
    expect(await ativo(antigo)).toBe(false);
    expect(await ativo(recente)).toBe(true);

    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
    expect(me.statusCode).toBe(401);

    const { rows } = await ctx.database.pool.query(
      `select ator_id, depois from reserva.auditoria
        where acao = 'USUARIO_DESATIVADO_INATIVIDADE' and entidade_id = $1`,
      [antigo.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ator_id).toBeNull();
    expect(rows[0].depois).toMatchObject({ ativo: false, diasSemLogin: 60 });
  });

  it('nunca desativa administradores', async () => {
    await semUsoHa(admin, 400);
    expect(await desativarContasSemUso(ctx.database)).toBe(0);
    expect(await ativo(admin)).toBe(true);
  });

  it('desligada (null), não desativa ninguém', async () => {
    const antigo = await criarUsuarioTeste(ctx.database.pool);
    await semUsoHa(antigo, 400);
    await ctx.database.pool.query(
      'update reserva.configuracoes set desativar_apos_dias_sem_login = null where id',
    );
    expect(await desativarContasSemUso(ctx.database)).toBe(0);
    expect(await ativo(antigo)).toBe(true);
  });

  it('no login: conta acima do prazo é desativada na hora (senha certa recebe 403)', async () => {
    const antigo = await criarUsuarioTeste(ctx.database.pool);
    await semUsoHa(antigo, 61);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: antigo.email, senha: antigo.senha },
    });
    expect(res.statusCode).toBe(403);
    expect(await ativo(antigo)).toBe(false);
  });

  it('reativar pelo administrador recomeça a contagem', async () => {
    const antigo = await criarUsuarioTeste(ctx.database.pool);
    await semUsoHa(antigo, 61);
    await desativarContasSemUso(ctx.database);

    const tokenAdmin = await login(ctx.app, admin);
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/usuarios/${antigo.id}`,
      payload: { ativo: true },
      ...comSessao(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);

    expect(await desativarContasSemUso(ctx.database)).toBe(0);
    expect(await ativo(antigo)).toBe(true);
    await login(ctx.app, antigo);
  });
});
