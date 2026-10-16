import { hojeNoFuso, somarDias } from '@reserva/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarSalaTeste,
  criarUsuarioTeste,
  resetDatabase,
  type UsuarioTeste,
} from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

describe('exclusão de contas (administrador)', () => {
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
    admin = await criarUsuarioTeste(ctx.database.pool, { nome: 'Ana Admin', perfil: 'ADMIN' });
    tokenAdmin = await login(ctx.app, admin);
  });

  const excluir = (id: string, payload: object, token = tokenAdmin) =>
    ctx.app.inject({
      method: 'POST',
      url: `/api/admin/usuarios/${id}/excluir`,
      payload,
      ...comSessao(token),
    });

  const linha = async (id: string) =>
    (
      await ctx.database.pool.query(
        'select nome, email, ativo, removido_em, senha_hash from reserva.usuarios where id = $1',
        [id],
      )
    ).rows[0];

  it('conta sem histórico é apagada por completo', async () => {
    const engano = await criarUsuarioTeste(ctx.database.pool, { nome: 'Cadastro Errado' });
    const res = await excluir(engano.id, { confirmacao: 'cadastro errado' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ modo: 'apagada', reservasCanceladas: 0 });
    expect(await linha(engano.id)).toBeUndefined();

    const { rows } = await ctx.database.pool.query(
      `select depois from reserva.auditoria where acao = 'USUARIO_EXCLUIDO' and entidade_id = $1`,
      [engano.id],
    );
    expect(rows[0].depois).toEqual({ modo: 'apagada' });
  });

  it('conta com reservas é anonimizada; as reservas ficam e somem da lista de usuários', async () => {
    const pessoa = await criarUsuarioTeste(ctx.database.pool, { nome: 'Caio Colaborador' });
    const token = await login(ctx.app, pessoa);
    const sala = await criarSalaTeste(ctx.database.pool);
    const data = somarDias(hojeNoFuso(new Date()), 3);
    const criada = await ctx.app.inject({
      method: 'POST',
      url: '/api/reservas',
      payload: { salaId: sala.id, data, horaInicio: '10:00', horaFim: '11:00', motivo: 'Reunião' },
      ...comSessao(token),
    });
    expect(criada.statusCode).toBe(201);

    // Com reserva futura, pede a decisão antes.
    let res = await excluir(pessoa.id, { confirmacao: 'Caio Colaborador' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USUARIO_COM_RESERVAS_FUTURAS');

    res = await excluir(pessoa.id, {
      confirmacao: 'Caio Colaborador',
      reservasFuturas: 'cancelar',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ modo: 'anonimizada', reservasCanceladas: 1 });

    const dados = await linha(pessoa.id);
    expect(dados.nome).toBe('Usuário removido');
    expect(dados.email).toBe(`removido-${pessoa.id}@removido.invalid`);
    expect(dados.ativo).toBe(false);
    expect(dados.removido_em).not.toBeNull();
    expect(dados.senha_hash).toBe('removido');

    // A sessão dela acabou e não entra mais com o e-mail antigo.
    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
    expect(me.statusCode).toBe(401);
    const loginAntigo = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: pessoa.email, senha: pessoa.senha },
    });
    expect(loginAntigo.statusCode).toBe(401);

    const lista = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/usuarios',
      ...comSessao(tokenAdmin),
    });
    expect(lista.json().usuarios.map((u: { id: string }) => u.id)).not.toContain(pessoa.id);

    // Conta removida não pode ser reativada.
    const reativar = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/usuarios/${pessoa.id}`,
      payload: { ativo: true },
      ...comSessao(tokenAdmin),
    });
    expect(reativar.statusCode).toBe(404);
  });

  it('recusa nome errado, a própria conta e o último administrador', async () => {
    const pessoa = await criarUsuarioTeste(ctx.database.pool, { nome: 'Bia Souza' });
    const errado = await excluir(pessoa.id, { confirmacao: 'Outra Pessoa' });
    expect(errado.statusCode).toBe(400);
    expect(errado.json().error.details[0].campo).toBe('confirmacao');

    const si = await excluir(admin.id, { confirmacao: 'Ana Admin' });
    expect(si.statusCode).toBe(409);

    // Outro admin tentando excluir a Ana, que é a única além dele: permitido (sobra 1).
    const outro = await criarUsuarioTeste(ctx.database.pool, {
      nome: 'Beto Admin',
      perfil: 'ADMIN',
    });
    const tokenOutro = await login(ctx.app, outro);
    expect((await excluir(admin.id, { confirmacao: 'Ana Admin' }, tokenOutro)).statusCode).toBe(
      200,
    );
  });

  it('colaborador não acessa a exclusão', async () => {
    const pessoa = await criarUsuarioTeste(ctx.database.pool);
    const token = await login(ctx.app, pessoa);
    const res = await excluir(admin.id, { confirmacao: 'Ana Admin' }, token);
    expect(res.statusCode).toBe(403);
  });
});
