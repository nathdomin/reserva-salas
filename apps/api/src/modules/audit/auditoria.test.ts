import { hojeNoFuso, somarDias } from '@reserva/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarSalaTeste,
  criarUsuarioTeste,
  resetDatabase,
  type UsuarioTeste,
} from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

describe('histórico de alterações (auditoria)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: UsuarioTeste;
  let colaborador: UsuarioTeste;
  let tokenAdmin: string;
  let tokenColaborador: string;
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
    admin = await criarUsuarioTeste(ctx.database.pool, { perfil: 'ADMIN', nome: 'Ana Admin' });
    colaborador = await criarUsuarioTeste(ctx.database.pool, { nome: 'Caio Colaborador' });
    tokenAdmin = await login(ctx.app, admin);
    tokenColaborador = await login(ctx.app, colaborador);

    // Gera registros reais: o colaborador cria e cancela; o administrador altera uma sala.
    const sala = await criarSalaTeste(ctx.database.pool, { nome: 'Sala Azul' });
    const criada = await ctx.app.inject({
      method: 'POST',
      url: '/api/reservas',
      payload: {
        salaId: sala.id,
        data: somarDias(hojeNoFuso(), 2),
        horaInicio: '10:00',
        horaFim: '11:00',
        motivo: 'Planejamento',
      },
      ...comSessao(tokenColaborador),
    });
    reservaId = criada.json().reserva.id;
    await ctx.app.inject({
      method: 'POST',
      url: `/api/reservas/${reservaId}/cancelar`,
      payload: {},
      ...comSessao(tokenColaborador),
    });
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/salas/${sala.id}`,
      payload: { capacidade: 12 },
      ...comSessao(tokenAdmin),
    });
  });

  const get = (url: string, token: string) =>
    ctx.app.inject({ method: 'GET', url, ...comSessao(token) });

  it('só o administrador consulta (401 sem login, 403 para colaborador)', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/admin/auditoria' })).statusCode).toBe(
      401,
    );
    expect((await get('/api/admin/auditoria', tokenColaborador)).statusCode).toBe(403);
  });

  it('lista do mais recente para o mais antigo, com quem fez e o que foi afetado', async () => {
    const res = await get('/api/admin/auditoria', tokenAdmin);
    expect(res.statusCode).toBe(200);
    const { registros, proximo } = res.json();
    expect(proximo).toBeNull();
    expect(registros.map((r: { acao: string }) => r.acao)).toEqual([
      'SALA_ATUALIZADA',
      'RESERVA_CANCELADA',
      'RESERVA_CRIADA',
    ]);
    expect(registros[0]).toMatchObject({
      entidade: 'sala',
      alvo: 'Sala Azul',
      ator: { id: admin.id, nome: 'Ana Admin' },
    });
    expect(registros[2].alvo).toMatch(/^Sala Azul, \d{2}\/\d{2}\/\d{4} 10:00$/);
    expect(registros[2].ator.nome).toBe('Caio Colaborador');
  });

  it('filtra por tipo, ação, pessoa, item e período', async () => {
    const nomes = async (query: string) =>
      (await get(`/api/admin/auditoria?${query}`, tokenAdmin))
        .json()
        .registros.map((r: { acao: string }) => r.acao);

    expect(await nomes('entidade=reserva')).toEqual(['RESERVA_CANCELADA', 'RESERVA_CRIADA']);
    expect(await nomes('acao=RESERVA_CRIADA')).toEqual(['RESERVA_CRIADA']);
    expect(await nomes(`atorId=${admin.id}`)).toEqual(['SALA_ATUALIZADA']);
    expect(await nomes(`entidade=reserva&entidadeId=${reservaId}`)).toHaveLength(2);
    const hoje = hojeNoFuso();
    expect(await nomes(`dataInicio=${hoje}&dataFim=${hoje}`)).toHaveLength(3);
    expect(await nomes(`dataInicio=${somarDias(hoje, 1)}`)).toEqual([]);
  });

  it('pagina com "antesDe" sem repetir nem pular registros', async () => {
    const p1 = (await get('/api/admin/auditoria?limite=2', tokenAdmin)).json();
    expect(p1.registros).toHaveLength(2);
    expect(p1.proximo).toBe(p1.registros[1].id);
    const p2 = (
      await get(`/api/admin/auditoria?limite=2&antesDe=${p1.proximo}`, tokenAdmin)
    ).json();
    expect(p2.registros.map((r: { acao: string }) => r.acao)).toEqual(['RESERVA_CRIADA']);
    expect(p2.proximo).toBeNull();
  });

  it('recusa filtros inválidos (400)', async () => {
    for (const q of ['acao=APAGAR_TUDO', 'dataInicio=2026-13-01', 'atorId=abc', 'limite=500']) {
      expect((await get(`/api/admin/auditoria?${q}`, tokenAdmin)).statusCode, q).toBe(400);
    }
  });
});
