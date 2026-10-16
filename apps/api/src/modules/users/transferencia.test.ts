import { hojeNoFuso, somarDias } from '@reserva/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarSalaTeste,
  criarUsuarioTeste,
  resetDatabase,
  type UsuarioTeste,
} from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

describe('transferir reservas futuras de quem sai', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: UsuarioTeste;
  let tokenAdmin: string;
  let saindo: UsuarioTeste;
  let recebe: UsuarioTeste;
  let reservaId: string;

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
    saindo = await criarUsuarioTeste(ctx.database.pool, { nome: 'Caio Saindo' });
    recebe = await criarUsuarioTeste(ctx.database.pool, { nome: 'Bia Recebe' });
    const sala = await criarSalaTeste(ctx.database.pool);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/reservas',
      payload: {
        salaId: sala.id,
        data: somarDias(hojeNoFuso(), 3),
        horaInicio: '10:00',
        horaFim: '11:00',
        motivo: 'Reunião de equipe',
      },
      ...comSessao(await login(ctx.app, saindo)),
    });
    expect(res.statusCode).toBe(201);
    reservaId = res.json().reserva.id;
  });

  const responsavel = async () =>
    (
      await ctx.database.pool.query<{ usuario_id: string; status: string }>(
        'select usuario_id, status from reserva.reservas where id = $1',
        [reservaId],
      )
    ).rows[0]!;

  const desativar = (payload: object) =>
    ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/usuarios/${saindo.id}`,
      payload: { ativo: false, ...payload },
      ...comSessao(tokenAdmin),
    });

  it('ao desativar: as reservas passam para a pessoa escolhida e ficam no histórico', async () => {
    const res = await desativar({ reservasFuturas: 'transferir', transferirPara: recebe.id });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ reservasTransferidas: 1, reservasCanceladas: 0 });
    expect(await responsavel()).toEqual({ usuario_id: recebe.id, status: 'ATIVA' });

    const { rows } = await ctx.database.pool.query(
      `select antes, depois from reserva.auditoria
        where acao = 'RESERVA_TRANSFERIDA' and entidade_id = $1`,
      [reservaId],
    );
    expect(rows[0]).toEqual({
      antes: { responsavelId: saindo.id },
      depois: { responsavelId: recebe.id, responsavel: 'Bia Recebe' },
    });
  });

  it('recusa transferir para a própria pessoa, para alguém inativo ou sem escolher', async () => {
    const inativa = await criarUsuarioTeste(ctx.database.pool, { ativo: false });
    for (const payload of [
      { reservasFuturas: 'transferir' },
      { reservasFuturas: 'transferir', transferirPara: saindo.id },
      { reservasFuturas: 'transferir', transferirPara: inativa.id },
    ]) {
      const res = await desativar(payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json().error.details[0].campo).toBe('transferirPara');
    }
    expect(await responsavel()).toEqual({ usuario_id: saindo.id, status: 'ATIVA' });
  });

  it('ao excluir: transfere as reservas e anonimiza (criar a reserva ficou no histórico)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/usuarios/${saindo.id}/excluir`,
      payload: {
        confirmacao: 'Caio Saindo',
        reservasFuturas: 'transferir',
        transferirPara: recebe.id,
      },
      ...comSessao(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      modo: 'anonimizada',
      reservasCanceladas: 0,
      reservasTransferidas: 1,
    });
    expect(await responsavel()).toEqual({ usuario_id: recebe.id, status: 'ATIVA' });
  });
});
