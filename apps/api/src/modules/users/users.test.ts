import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hojeNoFuso, somarDias } from '@reserva/shared';
import {
  criarSalaTeste,
  criarUsuarioTeste,
  resetDatabase,
  type UsuarioTeste,
} from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';
import { AdministradorJaExisteError, criarAdministrador, createUsersService } from './service';

describe('gestão de usuários (administrador)', () => {
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
    admin = await criarUsuarioTeste(ctx.database.pool, { nome: 'Admin', perfil: 'ADMIN' });
    tokenAdmin = await login(ctx.app, admin);
  });

  const api = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) =>
    ctx.app.inject({ method, url: `/api/admin/usuarios${url}`, payload, ...comSessao(token) });

  describe('permissões', () => {
    it('sem login: 401 em todas as rotas', async () => {
      for (const [method, url] of [
        ['GET', ''],
        ['POST', ''],
        ['PATCH', `/${admin.id}`],
        ['POST', `/${admin.id}/redefinir-senha`],
      ] as const) {
        const res = await ctx.app.inject({ method, url: `/api/admin/usuarios${url}`, payload: {} });
        expect(res.statusCode, `${method} ${url}`).toBe(401);
      }
    });

    it('colaborador: 403 em todas as rotas, mesmo chamando a API diretamente', async () => {
      const colaborador = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, colaborador);
      for (const [method, url] of [
        ['GET', ''],
        ['POST', ''],
        ['PATCH', `/${colaborador.id}`],
        ['POST', `/${admin.id}/redefinir-senha`],
      ] as const) {
        const res = await api(method, url, token, { perfil: 'ADMIN', novaSenha: 'x'.repeat(12) });
        expect(res.statusCode, `${method} ${url}`).toBe(403);
        expect(res.json().error.code).toBe('SEM_PERMISSAO');
      }
      // A tentativa de se promover não teve efeito.
      const { rows } = await ctx.database.pool.query(
        'select perfil from reserva.usuarios where id = $1',
        [colaborador.id],
      );
      expect(rows[0].perfil).toBe('COLABORADOR');
    });

    it('rebaixar um administrador tira o acesso dele na próxima requisição', async () => {
      const outroAdmin = await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN' });
      const tokenOutro = await login(ctx.app, outroAdmin);
      expect((await api('GET', '', tokenOutro)).statusCode).toBe(200);

      await api('PATCH', `/${outroAdmin.id}`, tokenAdmin, { perfil: 'COLABORADOR' });
      expect((await api('GET', '', tokenOutro)).statusCode).toBe(403);
    });
  });

  describe('listar e criar', () => {
    it('lista usuários sem expor senha', async () => {
      await criarUsuarioTeste(ctx.database.pool, { nome: 'Beatriz' });
      const res = await api('GET', '', tokenAdmin);
      expect(res.statusCode).toBe(200);
      const { usuarios } = res.json();
      expect(usuarios).toHaveLength(2);
      expect(usuarios[0]).toEqual(
        expect.objectContaining({ ativo: true, bloqueado: false, perfil: expect.any(String) }),
      );
      expect(res.body).not.toMatch(/senha|hash|scrypt/i);
    });

    it('cria usuário, normaliza o e-mail e registra na auditoria', async () => {
      const res = await api('POST', '', tokenAdmin, {
        nome: '  Carlos Lima ',
        email: 'Carlos.Lima@Empresa.com',
        senha: 'senha-inicial-123',
      });
      expect(res.statusCode).toBe(201);
      const { usuario } = res.json();
      expect(usuario).toMatchObject({
        nome: 'Carlos Lima',
        email: 'carlos.lima@empresa.com',
        perfil: 'COLABORADOR',
        ativo: true,
      });

      const { rows } = await ctx.database.pool.query(
        `select ator_id, acao, depois from reserva.auditoria where entidade_id = $1`,
        [usuario.id],
      );
      expect(rows).toEqual([
        expect.objectContaining({ ator_id: admin.id, acao: 'USUARIO_CRIADO' }),
      ]);
      expect(JSON.stringify(rows[0].depois)).not.toContain('senha-inicial-123');

      // O novo usuário consegue entrar.
      await login(ctx.app, { email: 'carlos.lima@empresa.com', senha: 'senha-inicial-123' });
    });

    it('recusa e-mail repetido (409) e senha fraca (400)', async () => {
      const existente = await criarUsuarioTeste(ctx.database.pool);
      const repetido = await api('POST', '', tokenAdmin, {
        nome: 'Outra Pessoa',
        email: existente.email.toUpperCase(),
        senha: 'senha-qualquer-123',
      });
      expect(repetido.statusCode).toBe(409);
      expect(repetido.json().error.code).toBe('EMAIL_EM_USO');

      const fraca = await api('POST', '', tokenAdmin, {
        nome: 'Pessoa',
        email: 'nova@empresa.com',
        senha: '123',
      });
      expect(fraca.statusCode).toBe(400);

      const igualEmail = await api('POST', '', tokenAdmin, {
        nome: 'Pessoa',
        email: 'nova.pessoa@empresa.com',
        senha: 'nova.pessoa@empresa.com',
      });
      expect(igualEmail.statusCode).toBe(400);
    });
  });

  describe('editar e desativar', () => {
    it('edita nome e perfil e registra antes/depois na auditoria', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool, { nome: 'Daniel' });
      const res = await api('PATCH', `/${usuario.id}`, tokenAdmin, {
        nome: 'Daniel Rocha',
        perfil: 'ADMIN',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().usuario).toMatchObject({ nome: 'Daniel Rocha', perfil: 'ADMIN' });

      const { rows } = await ctx.database.pool.query(
        `select acao, antes, depois from reserva.auditoria where entidade_id = $1`,
        [usuario.id],
      );
      expect(rows[0]).toEqual({
        acao: 'USUARIO_ATUALIZADO',
        antes: { nome: 'Daniel', perfil: 'COLABORADOR' },
        depois: { nome: 'Daniel Rocha', perfil: 'ADMIN' },
      });
    });

    it('desativar encerra as sessões do usuário na hora', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);

      const res = await api('PATCH', `/${usuario.id}`, tokenAdmin, { ativo: false });
      expect(res.statusCode).toBe(200);
      expect(res.json().usuario.ativo).toBe(false);

      const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
      expect(me.statusCode).toBe(401);
      const { rows } = await ctx.database.pool.query(
        'select count(*)::int as n from reserva.sessoes where usuario_id = $1',
        [usuario.id],
      );
      expect(rows[0].n).toBe(0);
    });

    describe('desativar quem tem reservas futuras', () => {
      async function comReservaFutura() {
        const usuario = await criarUsuarioTeste(ctx.database.pool, { nome: 'Caio' });
        const token = await login(ctx.app, usuario);
        const sala = await criarSalaTeste(ctx.database.pool, { nome: 'Sala Azul' });
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/reservas',
          payload: {
            salaId: sala.id,
            data: somarDias(hojeNoFuso(), 3),
            horaInicio: '10:00',
            horaFim: '11:00',
            motivo: 'Planejamento',
          },
          ...comSessao(token),
        });
        expect(res.statusCode).toBe(201);
        return { usuario, reservaId: res.json().reserva.id as string };
      }

      const statusDa = async (id: string) =>
        (
          await ctx.database.pool.query(
            'select status, motivo_cancelamento from reserva.reservas where id = $1',
            [id],
          )
        ).rows[0];

      it('sem decisão: 409 com as reservas, e nada muda', async () => {
        const { usuario, reservaId } = await comReservaFutura();
        const res = await api('PATCH', `/${usuario.id}`, tokenAdmin, { ativo: false });
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe('USUARIO_COM_RESERVAS_FUTURAS');
        expect(res.json().error.details).toMatchObject({
          total: 1,
          reservas: [{ id: reservaId, sala: 'Sala Azul' }],
        });
        const { rows } = await ctx.database.pool.query(
          'select ativo from reserva.usuarios where id = $1',
          [usuario.id],
        );
        expect(rows[0].ativo).toBe(true);
        expect((await statusDa(reservaId)).status).toBe('ATIVA');
      });

      it('"cancelar": desativa e cancela as reservas futuras, com histórico', async () => {
        const { usuario, reservaId } = await comReservaFutura();
        const res = await api('PATCH', `/${usuario.id}`, tokenAdmin, {
          ativo: false,
          reservasFuturas: 'cancelar',
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ usuario: { ativo: false }, reservasCanceladas: 1 });
        expect(await statusDa(reservaId)).toEqual({
          status: 'CANCELADA',
          motivo_cancelamento: 'Responsável (Caio) desativado pela administração.',
        });
        const { rows } = await ctx.database.pool.query(
          `select acao from reserva.auditoria where entidade_id = $1 order by id`,
          [reservaId],
        );
        expect(rows.map((r) => r.acao)).toEqual(['RESERVA_CRIADA', 'RESERVA_CANCELADA']);
      });

      it('"manter": desativa e mantém as reservas', async () => {
        const { usuario, reservaId } = await comReservaFutura();
        const res = await api('PATCH', `/${usuario.id}`, tokenAdmin, {
          ativo: false,
          reservasFuturas: 'manter',
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().reservasCanceladas).toBe(0);
        expect((await statusDa(reservaId)).status).toBe('ATIVA');
      });

      it('só a decisão, sem nenhuma alteração, é recusada (400)', async () => {
        const { usuario } = await comReservaFutura();
        const res = await api('PATCH', `/${usuario.id}`, tokenAdmin, {
          reservasFuturas: 'cancelar',
        });
        expect(res.statusCode).toBe(400);
      });
    });

    it('reativar devolve o acesso', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool, { ativo: false });
      const res = await api('PATCH', `/${usuario.id}`, tokenAdmin, { ativo: true });
      expect(res.statusCode).toBe(200);
      await login(ctx.app, usuario);
    });

    it('o administrador não pode desativar a si mesmo nem tirar o próprio perfil', async () => {
      await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN' });
      for (const payload of [{ ativo: false }, { perfil: 'COLABORADOR' }]) {
        const res = await api('PATCH', `/${admin.id}`, tokenAdmin, payload);
        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe('OPERACAO_NAO_PERMITIDA');
      }
    });

    it('o sistema nunca fica sem administrador ativo', async () => {
      // "admin" é o único administrador ativo. Mesmo uma operação feita por outra pessoa
      // (simulada direto no serviço) não consegue desativá-lo nem rebaixá-lo.
      const users = createUsersService(ctx.database);
      const outraPessoa = { id: '00000000-0000-4000-8000-000000000001', ip: null };
      for (const dados of [{ ativo: false }, { perfil: 'COLABORADOR' as const }]) {
        await expect(users.atualizar(outraPessoa, admin.id, dados)).rejects.toMatchObject({
          statusCode: 409,
          message: 'É preciso manter pelo menos um administrador ativo.',
        });
      }
      // Com um segundo administrador ativo, rebaixar o primeiro passa a ser permitido.
      const segundo = await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN' });
      const tokenSegundo = await login(ctx.app, segundo);
      const res = await api('PATCH', `/${admin.id}`, tokenSegundo, { perfil: 'COLABORADOR' });
      expect(res.statusCode).toBe(200);
    });

    it('e-mail repetido na edição devolve 409', async () => {
      const a = await criarUsuarioTeste(ctx.database.pool);
      const b = await criarUsuarioTeste(ctx.database.pool);
      const res = await api('PATCH', `/${b.id}`, tokenAdmin, { email: a.email });
      expect(res.statusCode).toBe(409);
    });

    it('id inválido devolve 400 e id inexistente devolve 404', async () => {
      expect((await api('PATCH', '/nao-e-uuid', tokenAdmin, { nome: 'X Y' })).statusCode).toBe(400);
      const res = await api('PATCH', '/00000000-0000-4000-8000-000000000000', tokenAdmin, {
        nome: 'X Y',
      });
      expect(res.statusCode).toBe(404);
    });

    it('PATCH sem nenhum campo devolve 400', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      expect((await api('PATCH', `/${usuario.id}`, tokenAdmin, {})).statusCode).toBe(400);
    });
  });

  describe('redefinir senha', () => {
    it('define nova senha, desbloqueia e encerra as sessões do usuário', async () => {
      const usuario = await criarUsuarioTeste(ctx.database.pool);
      const token = await login(ctx.app, usuario);
      await ctx.database.pool.query(
        `update reserva.usuarios set bloqueado_ate = now() + interval '10 minutes' where id = $1`,
        [usuario.id],
      );

      const res = await api('POST', `/${usuario.id}/redefinir-senha`, tokenAdmin, {
        novaSenha: 'senha-redefinida-123',
      });
      expect(res.statusCode).toBe(204);

      const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', ...comSessao(token) });
      expect(me.statusCode).toBe(401);
      await login(ctx.app, { email: usuario.email, senha: 'senha-redefinida-123' });
    });

    it('o administrador não redefine a própria senha por aqui', async () => {
      const res = await api('POST', `/${admin.id}/redefinir-senha`, tokenAdmin, {
        novaSenha: 'outra-senha-1234',
      });
      expect(res.statusCode).toBe(409);
    });
  });
});

describe('criação do administrador pelo terminal', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.database.pool);
  });

  const dados = { nome: 'Primeira Admin', email: 'admin@empresa.com', senha: 'senha-admin-2026' };

  it('cria o primeiro administrador, que consegue entrar', async () => {
    const { usuario, recuperado } = await criarAdministrador(ctx.database, dados, {
      forcar: false,
    });
    expect(recuperado).toBe(false);
    expect(usuario).toMatchObject({ email: 'admin@empresa.com', perfil: 'ADMIN', ativo: true });
    await login(ctx.app, dados);

    const { rows } = await ctx.database.pool.query(
      `select acao, ator_id from reserva.auditoria where entidade_id = $1`,
      [usuario.id],
    );
    expect(rows).toEqual([{ acao: 'ADMIN_CRIADO_TERMINAL', ator_id: null }]);
  });

  it('recusa criar outro se já existe administrador ativo', async () => {
    await criarAdministrador(ctx.database, dados, { forcar: false });
    await expect(
      criarAdministrador(ctx.database, { ...dados, email: 'outro@empresa.com' }, { forcar: false }),
    ).rejects.toBeInstanceOf(AdministradorJaExisteError);
  });

  it('com --force recupera o acesso: promove, reativa, troca a senha e encerra sessões', async () => {
    const pessoa = await criarUsuarioTeste(ctx.database.pool, {
      email: 'admin@empresa.com',
      ativo: false,
    });
    await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN' });

    const { usuario, recuperado } = await criarAdministrador(ctx.database, dados, {
      forcar: true,
    });
    expect(recuperado).toBe(true);
    expect(usuario).toMatchObject({ id: pessoa.id, perfil: 'ADMIN', ativo: true });
    await login(ctx.app, dados);
  });
});
