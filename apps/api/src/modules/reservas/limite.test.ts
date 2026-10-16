import { hojeNoFuso, somarDias } from '@reserva/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarSalaTeste, criarUsuarioTeste, resetDatabase, type SalaTeste } from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

describe('limite de reservas futuras por pessoa', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let sala: SalaTeste;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.ready();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.database.pool);
    sala = await criarSalaTeste(ctx.database.pool);
    await ctx.database.pool.query(
      'update reserva.configuracoes set max_reservas_futuras_por_pessoa = 2 where id',
    );
  });

  /** Reserva das 10h às 11h, em dias diferentes para não conflitar. */
  const reservar = (token: string, dias: number) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/reservas',
      payload: {
        salaId: sala.id,
        data: somarDias(hojeNoFuso(), dias),
        horaInicio: '10:00',
        horaFim: '11:00',
        motivo: 'Reunião de equipe',
      },
      ...comSessao(token),
    });

  it('colaborador para no limite; cancelar uma libera espaço', async () => {
    const token = await login(ctx.app, await criarUsuarioTeste(ctx.database.pool));
    const primeira = await reservar(token, 3);
    expect(primeira.statusCode).toBe(201);
    expect((await reservar(token, 4)).statusCode).toBe(201);

    const terceira = await reservar(token, 5);
    expect(terceira.statusCode).toBe(422);
    expect(terceira.json().error.code).toBe('LIMITE_DE_RESERVAS');
    expect(terceira.json().error.details).toEqual({ limite: 2 });

    const cancelar = await ctx.app.inject({
      method: 'POST',
      url: `/api/reservas/${primeira.json().reserva.id}/cancelar`,
      payload: {},
      ...comSessao(token),
    });
    expect(cancelar.statusCode).toBe(200);
    expect((await reservar(token, 5)).statusCode).toBe(201);
  });

  it('administrador não tem limite, e sem limite configurado ninguém tem', async () => {
    const tokenAdmin = await login(
      ctx.app,
      await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN' }),
    );
    for (const dias of [3, 4, 5]) expect((await reservar(tokenAdmin, dias)).statusCode).toBe(201);

    await ctx.database.pool.query(
      'update reserva.configuracoes set max_reservas_futuras_por_pessoa = null where id',
    );
    const token = await login(ctx.app, await criarUsuarioTeste(ctx.database.pool));
    // Outra sala: na primeira, esses horários já estão ocupados pelo administrador.
    const outraSala = await criarSalaTeste(ctx.database.pool);
    for (const dias of [3, 4, 5]) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/reservas',
        payload: {
          salaId: outraSala.id,
          data: somarDias(hojeNoFuso(), dias),
          horaInicio: '10:00',
          horaFim: '11:00',
          motivo: 'Reunião de equipe',
        },
        ...comSessao(token),
      });
      expect(res.statusCode).toBe(201);
    }
  });
});
