import { hojeNoFuso, somarDias } from '@reserva/shared';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarSalaTeste, criarUsuarioTeste, resetDatabase } from '../../test/db';
import { comSessao, createTestApp, login } from '../../test/helpers';
import { gerarBackup, lerCabecalho, restaurarBackup } from './backup';

describe('backup e restauração dos dados', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.ready();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  // Dados reais criados pela API: usuário, sala, reserva (com histórico) e configuração alterada.
  beforeEach(async () => {
    await resetDatabase(ctx.database.pool);
    const pessoa = await criarUsuarioTeste(ctx.database.pool, {
      nome: "Joana D'Arc",
      perfil: 'ADMIN',
    });
    const token = await login(ctx.app, pessoa);
    const sala = await criarSalaTeste(ctx.database.pool, { nome: 'Sala Azul' });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/reservas',
      // Texto com aspas, cifrão e emoji: o backup não pode corromper nada.
      payload: {
        salaId: sala.id,
        data: somarDias(hojeNoFuso(), 2),
        horaInicio: '10:00',
        horaFim: '11:00',
        motivo: "Orçamento 'Q4' — $$ fechamento $dados$ 🚀",
      },
      ...comSessao(token),
    });
    expect(res.statusCode).toBe(201);
    await ctx.app.inject({
      method: 'PATCH',
      url: '/api/admin/configuracoes',
      payload: { antecedenciaMaximaDias: 60 },
      ...comSessao(token),
    });
  });

  async function retrato() {
    const tabelas = ['usuarios', 'salas', 'configuracoes', 'reservas', 'auditoria'];
    const r: Record<string, unknown> = {};
    for (const t of tabelas) {
      const { rows } = await ctx.database.pool.query(
        `select coalesce(json_agg(x order by x::text), '[]') as j from reserva.${t} x`,
      );
      r[t] = rows[0].j;
    }
    return r;
  }

  async function comCliente<T>(fn: (c: pg.PoolClient) => Promise<T>) {
    const client = await ctx.database.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  it('restaura exatamente os mesmos dados num banco vazio', async () => {
    const antes = await retrato();
    const backup = await comCliente((c) => gerarBackup(c));
    expect(lerCabecalho(backup)?.linhas).toMatchObject({ usuarios: 1, salas: 1, reservas: 1 });

    await resetDatabase(ctx.database.pool);
    await comCliente((c) => restaurarBackup(c, backup));
    expect(await retrato()).toEqual(antes);

    // O histórico continua numerando depois do último registro restaurado.
    const { rows } = await ctx.database.pool.query(
      `insert into reserva.auditoria (acao, entidade) values ('TESTE', 'sala') returning id`,
    );
    const { rows: max } = await ctx.database.pool.query(
      `select max(id) as m from reserva.auditoria where acao <> 'TESTE'`,
    );
    expect(Number(rows[0].id)).toBeGreaterThan(Number(max[0].m));
  });

  it('não restaura por cima de dados existentes sem --substituir', async () => {
    const backup = await comCliente((c) => gerarBackup(c));
    await expect(comCliente((c) => restaurarBackup(c, backup))).rejects.toThrow(/já tem dados/);
    // Com "substituir", apaga o atual e restaura.
    const antes = await retrato();
    await ctx.database.pool.query(`update reserva.salas set nome = 'Alterada'`);
    await comCliente((c) => restaurarBackup(c, backup, { substituir: true }));
    expect(await retrato()).toEqual(antes);
  });

  it('se a restauração falhar no meio, nada muda', async () => {
    const backup = await comCliente((c) => gerarBackup(c));
    const antes = await retrato();
    const quebrado = backup.replace(
      'insert into reserva.reservas',
      'insert into reserva.inexistente',
    );
    await expect(
      comCliente((c) => restaurarBackup(c, quebrado, { substituir: true })),
    ).rejects.toThrow();
    expect(await retrato()).toEqual(antes);
  });

  it('recusa arquivos que não são backup e backups de versão mais nova', async () => {
    await resetDatabase(ctx.database.pool);
    await expect(comCliente((c) => restaurarBackup(c, 'select 1;'))).rejects.toThrow(
      /não é um backup/,
    );
    const backup = await comCliente((c) => gerarBackup(c));
    const futuro = backup.replace('"migracoes":[', '"migracoes":["9999_futura.sql",');
    await expect(comCliente((c) => restaurarBackup(c, futuro))).rejects.toThrow(/migrações|versão/);
  });
});
