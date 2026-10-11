import { hojeNoFuso, somarDias } from '@reserva/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarSalaTeste,
  criarUsuarioTeste,
  resetDatabase,
  type UsuarioTeste,
} from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

describe('configurações', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: UsuarioTeste;
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
    const colaborador = await criarUsuarioTeste(ctx.database.pool);
    tokenAdmin = await login(ctx.app, admin);
    tokenColaborador = await login(ctx.app, colaborador);
  });

  const patch = (token: string, payload: object) =>
    ctx.app.inject({
      method: 'PATCH',
      url: '/api/admin/configuracoes',
      payload,
      ...comSessao(token),
    });

  const ler = async (token: string) =>
    (await ctx.app.inject({ method: 'GET', url: '/api/configuracoes', ...comSessao(token) })).json()
      .configuracoes;

  it('sem login: 401; colaborador: 403, mesmo chamando a API diretamente', async () => {
    const semLogin = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/admin/configuracoes',
      payload: { antecedenciaMaximaDias: 10 },
    });
    expect(semLogin.statusCode).toBe(401);
    expect((await patch(tokenColaborador, { antecedenciaMaximaDias: 10 })).statusCode).toBe(403);
    expect((await ler(tokenAdmin)).antecedenciaMaximaDias).toBe(120);
  });

  it('o administrador altera, todos passam a ler o novo valor e a auditoria guarda antes/depois', async () => {
    const res = await patch(tokenAdmin, {
      motivoVisivelParaTodos: false,
      horarioInicio: '08:00',
      horarioFim: '18:00',
      intervaloEntreReunioesMinutos: 10,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().configuracoes).toMatchObject({
      motivoVisivelParaTodos: false,
      horarioInicio: '08:00',
      horarioFim: '18:00',
      intervaloEntreReunioesMinutos: 10,
      antecedenciaMaximaDias: 120,
    });
    expect(await ler(tokenColaborador)).toMatchObject({ horarioInicio: '08:00' });

    const { rows } = await ctx.database.pool.query(
      `select ator_id, antes, depois from reserva.auditoria where acao = 'CONFIGURACOES_ALTERADAS'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ator_id).toBe(admin.id);
    expect(rows[0].antes).toEqual({
      motivoVisivelParaTodos: true,
      horarioInicio: '07:00',
      horarioFim: '20:00',
      intervaloEntreReunioesMinutos: 0,
    });
    expect(rows[0].depois).toMatchObject({ horarioFim: '18:00' });
  });

  it('recusa combinações inválidas e não altera nada', async () => {
    const casos: [object, string][] = [
      [{ horarioInicio: '19:00', horarioFim: '08:00' }, 'horarioFim'],
      [{ horarioInicio: '07:10' }, 'horarioInicio'],
      [{ granularidadeMinutos: 7 }, 'granularidadeMinutos'],
      [{ duracaoMinimaMinutos: 60, duracaoMaximaMinutos: 30 }, 'duracaoMaximaMinutos'],
      [{ duracaoMaximaMinutos: 900 }, 'duracaoMaximaMinutos'],
      [{ antecedenciaMaximaDias: 0 }, 'antecedenciaMaximaDias'],
      [{ intervaloEntreReunioesMinutos: 90 }, 'intervaloEntreReunioesMinutos'],
      [{}, ''],
    ];
    for (const [payload, campo] of casos) {
      const res = await patch(tokenAdmin, payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      if (campo) {
        expect(
          (res.json().error.details as { campo: string }[]).map((d) => d.campo),
          JSON.stringify(payload),
        ).toContain(campo);
      }
    }
    expect(await ler(tokenAdmin)).toMatchObject({
      horarioInicio: '07:00',
      horarioFim: '20:00',
      granularidadeMinutos: 15,
    });
  });

  it('as novas regras valem para as próximas reservas', async () => {
    const sala = await criarSalaTeste(ctx.database.pool);
    const data = somarDias(hojeNoFuso(), 3);
    expect((await patch(tokenAdmin, { horarioInicio: '09:00' })).statusCode).toBe(200);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/reservas',
      payload: { salaId: sala.id, data, horaInicio: '08:00', horaFim: '09:00', motivo: 'Cedo' },
      ...comSessao(tokenColaborador),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('HORARIO_INVALIDO');
  });
});
