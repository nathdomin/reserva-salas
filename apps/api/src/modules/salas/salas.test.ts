import { hojeNoFuso, paraInstante, somarDias } from '@reserva/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarSalaTeste,
  criarUsuarioTeste,
  resetDatabase,
  type UsuarioTeste,
} from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

describe('salas', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: UsuarioTeste;
  let colaborador: UsuarioTeste;
  let tokenAdmin: string;
  let tokenColaborador: string;

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
    colaborador = await criarUsuarioTeste(ctx.database.pool);
    tokenAdmin = await login(ctx.app, admin);
    tokenColaborador = await login(ctx.app, colaborador);
  });

  const req = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) =>
    ctx.app.inject({ method, url, payload, ...comSessao(token) });

  const novaSala = {
    nome: 'Sala Azul',
    localizacao: '2º andar',
    capacidade: 8,
    recursos: ['Televisão', 'Projetor', 'televisão'],
    descricao: '  Perto da copa  ',
  };

  describe('permissões', () => {
    it('sem login: 401', async () => {
      expect((await ctx.app.inject({ method: 'GET', url: '/api/salas' })).statusCode).toBe(401);
    });

    it('colaborador consulta salas, mas não cadastra nem altera (403)', async () => {
      const sala = await criarSalaTeste(ctx.database.pool);
      expect((await req('GET', '/api/salas', tokenColaborador)).statusCode).toBe(200);
      expect((await req('POST', '/api/admin/salas', tokenColaborador, novaSala)).statusCode).toBe(
        403,
      );
      expect(
        (await req('PATCH', `/api/admin/salas/${sala.id}`, tokenColaborador, { ativo: false }))
          .statusCode,
      ).toBe(403);
    });

    it('colaborador não vê salas desativadas, mesmo pedindo', async () => {
      await criarSalaTeste(ctx.database.pool, { nome: 'Ativa' });
      await criarSalaTeste(ctx.database.pool, { nome: 'Desativada', ativo: false });
      const res = await req('GET', '/api/salas?incluirInativas=true', tokenColaborador);
      expect(res.json().salas.map((s: { nome: string }) => s.nome)).toEqual(['Ativa']);
      const resAdmin = await req('GET', '/api/salas?incluirInativas=true', tokenAdmin);
      expect(resAdmin.json().salas).toHaveLength(2);
      // Nem consultando a sala desativada diretamente.
      const desativada = resAdmin.json().salas.find((s: { ativo: boolean }) => !s.ativo);
      expect((await req('GET', `/api/salas/${desativada.id}`, tokenColaborador)).statusCode).toBe(
        404,
      );
      expect((await req('GET', `/api/salas/${desativada.id}`, tokenAdmin)).statusCode).toBe(200);
      // Respostas da API não ficam em cache.
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('cadastro', () => {
    it('cria sala, remove recursos repetidos e registra na auditoria', async () => {
      const res = await req('POST', '/api/admin/salas', tokenAdmin, novaSala);
      expect(res.statusCode).toBe(201);
      expect(res.json().sala).toMatchObject({
        nome: 'Sala Azul',
        capacidade: 8,
        recursos: ['Televisão', 'Projetor'],
        descricao: 'Perto da copa',
        ativo: true,
      });
      const { rows } = await ctx.database.pool.query(
        `select acao, ator_id from reserva.auditoria where entidade = 'sala'`,
      );
      expect(rows).toEqual([{ acao: 'SALA_CRIADA', ator_id: admin.id }]);
    });

    it('recusa nome repetido (sem diferenciar maiúsculas) e dados inválidos', async () => {
      await req('POST', '/api/admin/salas', tokenAdmin, novaSala);
      const repetida = await req('POST', '/api/admin/salas', tokenAdmin, {
        ...novaSala,
        nome: 'sala azul',
      });
      expect(repetida.statusCode).toBe(409);
      expect(repetida.json().error.code).toBe('SALA_NOME_EM_USO');

      const invalida = await req('POST', '/api/admin/salas', tokenAdmin, {
        nome: '',
        localizacao: 'x',
        capacidade: 0,
      });
      expect(invalida.statusCode).toBe(400);
      const campos = invalida.json().error.details.map((d: { campo: string }) => d.campo);
      expect(campos).toEqual(expect.arrayContaining(['nome', 'capacidade']));
    });

    it('edita dados e pode apagar a descrição', async () => {
      const criada = (await req('POST', '/api/admin/salas', tokenAdmin, novaSala)).json().sala;
      const res = await req('PATCH', `/api/admin/salas/${criada.id}`, tokenAdmin, {
        capacidade: 10,
        descricao: null,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().sala).toMatchObject({ capacidade: 10, descricao: null, nome: 'Sala Azul' });
    });
  });

  describe('desativação', () => {
    async function reservaFutura(salaId: string) {
      const dia = somarDias(hojeNoFuso(), 3);
      await ctx.database.pool.query(
        `insert into reserva.reservas (sala_id, usuario_id, motivo, inicio, fim)
         values ($1, $2, 'Reunião futura', $3, $4)`,
        [salaId, colaborador.id, paraInstante(dia, '10:00'), paraInstante(dia, '11:00')],
      );
    }

    it('sem reservas futuras, desativa direto', async () => {
      const sala = await criarSalaTeste(ctx.database.pool);
      const res = await req('PATCH', `/api/admin/salas/${sala.id}`, tokenAdmin, { ativo: false });
      expect(res.statusCode).toBe(200);
      expect(res.json().sala.ativo).toBe(false);
    });

    it('com reservas futuras, pede a decisão e mostra quais são', async () => {
      const sala = await criarSalaTeste(ctx.database.pool);
      await reservaFutura(sala.id);
      const res = await req('PATCH', `/api/admin/salas/${sala.id}`, tokenAdmin, { ativo: false });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('SALA_COM_RESERVAS_FUTURAS');
      expect(res.json().error.details.total).toBe(1);
      // Nada mudou.
      const { rows } = await ctx.database.pool.query(
        'select ativo from reserva.salas where id = $1',
        [sala.id],
      );
      expect(rows[0].ativo).toBe(true);
    });

    it('"cancelar": desativa e cancela as reservas futuras, com histórico', async () => {
      const sala = await criarSalaTeste(ctx.database.pool);
      await reservaFutura(sala.id);
      const res = await req('PATCH', `/api/admin/salas/${sala.id}`, tokenAdmin, {
        ativo: false,
        reservasFuturas: 'cancelar',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().reservasCanceladas).toBe(1);
      const { rows } = await ctx.database.pool.query(
        'select status, cancelada_por, motivo_cancelamento from reserva.reservas',
      );
      expect(rows[0]).toMatchObject({ status: 'CANCELADA', cancelada_por: admin.id });
      expect(rows[0].motivo_cancelamento).toMatch(/desativada/);
    });

    it('"manter": desativa e mantém as reservas já feitas', async () => {
      const sala = await criarSalaTeste(ctx.database.pool);
      await reservaFutura(sala.id);
      const res = await req('PATCH', `/api/admin/salas/${sala.id}`, tokenAdmin, {
        ativo: false,
        reservasFuturas: 'manter',
      });
      expect(res.statusCode).toBe(200);
      const { rows } = await ctx.database.pool.query('select status from reserva.reservas');
      expect(rows[0].status).toBe('ATIVA');
    });
  });
});
