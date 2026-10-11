import { hojeNoFuso, somarDias } from '@reserva/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarSalaTeste,
  criarUsuarioTeste,
  resetDatabase,
  type SalaTeste,
  type UsuarioTeste,
} from '../../../test/db';
import { comSessao, createTestApp, login } from '../../../test/helpers';

/** Sempre alguns dias à frente: os testes não dependem da hora em que rodam. */
const DIA = () => somarDias(hojeNoFuso(), 3);

describe('reservas', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: UsuarioTeste;
  let ana: UsuarioTeste;
  let bruno: UsuarioTeste;
  let tokens: { admin: string; ana: string; bruno: string };
  let azul: SalaTeste;
  let verde: SalaTeste;

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
    ana = await criarUsuarioTeste(ctx.database.pool, { nome: 'Ana Souza' });
    bruno = await criarUsuarioTeste(ctx.database.pool, { nome: 'Bruno Lima' });
    tokens = {
      admin: await login(ctx.app, admin),
      ana: await login(ctx.app, ana),
      bruno: await login(ctx.app, bruno),
    };
    azul = await criarSalaTeste(ctx.database.pool, { nome: 'Sala Azul', capacidade: 8 });
    verde = await criarSalaTeste(ctx.database.pool, { nome: 'Sala Verde', capacidade: 4 });
  });

  const reservar = (token: string, dados: Record<string, unknown>) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/reservas',
      payload: { salaId: azul.id, data: DIA(), motivo: 'Reunião de equipe', ...dados },
      ...comSessao(token),
    });

  const editar = (token: string, id: string, dados: Record<string, unknown>) =>
    ctx.app.inject({
      method: 'PATCH',
      url: `/api/reservas/${id}`,
      payload: dados,
      ...comSessao(token),
    });

  const cancelar = (token: string, id: string, motivo?: string) =>
    ctx.app.inject({
      method: 'POST',
      url: `/api/reservas/${id}/cancelar`,
      payload: motivo ? { motivo } : {},
      ...comSessao(token),
    });

  async function reservaDaAna(horaInicio = '10:00', horaFim = '11:00') {
    const res = await reservar(tokens.ana, { horaInicio, horaFim, participantes: 3 });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().reserva;
  }

  describe('criação', () => {
    it('cria uma reserva válida em nome de quem está logado, com auditoria', async () => {
      const res = await reservar(tokens.ana, {
        horaInicio: '10:00',
        horaFim: '11:30',
        participantes: 5,
        // Tentar reservar em nome de outra pessoa não tem efeito.
        usuarioId: bruno.id,
      });
      expect(res.statusCode).toBe(201);
      const { reserva } = res.json();
      expect(reserva).toMatchObject({
        sala: { id: azul.id, nome: 'Sala Azul' },
        responsavel: { id: ana.id, nome: 'Ana Souza' },
        motivo: 'Reunião de equipe',
        participantes: 5,
        status: 'ATIVA',
        diaInteiro: false,
        versao: 1,
        podeEditar: true,
        podeCancelar: true,
      });
      const { rows } = await ctx.database.pool.query(
        `select acao, ator_id from reserva.auditoria where entidade = 'reserva'`,
      );
      expect(rows).toEqual([{ acao: 'RESERVA_CRIADA', ator_id: ana.id }]);
    });

    it('sem login: 401', async () => {
      const res = await ctx.app.inject({ method: 'POST', url: '/api/reservas', payload: {} });
      expect(res.statusCode).toBe(401);
    });

    it.each([
      ['sem motivo', { horaInicio: '10:00', horaFim: '11:00', motivo: '' }, 'motivo'],
      ['término antes do início', { horaInicio: '11:00', horaFim: '10:00' }, 'horaFim'],
      ['fora do horário de funcionamento', { horaInicio: '06:00', horaFim: '07:30' }, 'horaInicio'],
      ['minutos fora do intervalo de 15', { horaInicio: '10:10', horaFim: '11:00' }, 'horaInicio'],
      ['mais de 8 horas', { horaInicio: '08:00', horaFim: '17:00' }, 'horaFim'],
      [
        'data no passado',
        { data: somarDias(hojeNoFuso(), -1), horaInicio: '10:00', horaFim: '11:00' },
        'data',
      ],
      [
        'mais de 120 dias à frente',
        { data: somarDias(hojeNoFuso(), 121), horaInicio: '10:00', horaFim: '11:00' },
        'data',
      ],
      ['data inexistente', { data: '2026-02-30', horaInicio: '10:00', horaFim: '11:00' }, 'data'],
    ])('recusa reserva inválida: %s (400)', async (_nome, dados, campo) => {
      const res = await reservar(tokens.ana, dados);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.details.map((d: { campo: string }) => d.campo)).toContain(campo);
      const { rows } = await ctx.database.pool.query(
        'select count(*)::int as n from reserva.reservas',
      );
      expect(rows[0].n).toBe(0);
    });

    it('recusa sala desativada (422) e sala inexistente (404)', async () => {
      const inativa = await criarSalaTeste(ctx.database.pool, { ativo: false });
      const r1 = await reservar(tokens.ana, {
        salaId: inativa.id,
        horaInicio: '10:00',
        horaFim: '11:00',
      });
      expect(r1.statusCode).toBe(422);
      expect(r1.json().error.code).toBe('SALA_INATIVA');
      const r2 = await reservar(tokens.ana, {
        salaId: '00000000-0000-4000-8000-000000000000',
        horaInicio: '10:00',
        horaFim: '11:00',
      });
      expect(r2.statusCode).toBe(404);
    });

    it('recusa mais participantes do que a capacidade da sala (422)', async () => {
      const res = await reservar(tokens.ana, {
        salaId: verde.id,
        horaInicio: '10:00',
        horaFim: '11:00',
        participantes: 5,
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.message).toMatch(/comporta até 4/);
    });

    it('"dia inteiro" ocupa das 07:00 às 20:00 e bloqueia o dia', async () => {
      const res = await reservar(tokens.ana, { diaInteiro: true, motivo: 'Treinamento' });
      expect(res.statusCode).toBe(201);
      const { reserva } = res.json();
      expect(reserva.diaInteiro).toBe(true);
      expect(new Date(reserva.fim).getTime() - new Date(reserva.inicio).getTime()).toBe(
        13 * 3600_000,
      );
      const outra = await reservar(tokens.bruno, { horaInicio: '15:00', horaFim: '16:00' });
      expect(outra.statusCode).toBe(409);
    });
  });

  describe('prevenção de conflitos', () => {
    it.each([
      ['sobreposição parcial (10:30–11:30)', '10:30', '11:30'],
      ['contida (10:15–10:45)', '10:15', '10:45'],
      ['envolvendo (09:00–12:00)', '09:00', '12:00'],
      ['exatamente igual (10:00–11:00)', '10:00', '11:00'],
    ])('bloqueia %s e explica o motivo', async (_nome, horaInicio, horaFim) => {
      await reservaDaAna('10:00', '11:00');
      const res = await reservar(tokens.bruno, { horaInicio, horaFim });
      expect(res.statusCode).toBe(409);
      const { error } = res.json();
      expect(error.code).toBe('RESERVA_CONFLITO');
      expect(error.message).toMatch(/Sala Azul já está reservada das 10:00 às 11:00/);
      expect(error.details.conflitos).toHaveLength(1);
    });

    it('permite reservas encostadas (11:00–12:00 depois de 10:00–11:00)', async () => {
      await reservaDaAna('10:00', '11:00');
      const res = await reservar(tokens.bruno, { horaInicio: '11:00', horaFim: '12:00' });
      expect(res.statusCode).toBe(201);
    });

    it('permite o mesmo horário em outra sala', async () => {
      await reservaDaAna('10:00', '11:00');
      const res = await reservar(tokens.bruno, {
        salaId: verde.id,
        horaInicio: '10:00',
        horaFim: '11:00',
      });
      expect(res.statusCode).toBe(201);
    });

    it('sugere horários livres na mesma sala e outras salas livres', async () => {
      await reservaDaAna('10:00', '11:00');
      const res = await reservar(tokens.bruno, {
        horaInicio: '10:30',
        horaFim: '11:00',
        participantes: 3,
      });
      const { sugestoes } = res.json().error.details;
      expect(sugestoes.horarios.length).toBeGreaterThan(0);
      for (const h of sugestoes.horarios) {
        // Nenhuma sugestão cai dentro de 10:00–11:00.
        expect(h.horaFim <= '10:00' || h.horaInicio >= '11:00').toBe(true);
      }
      expect(sugestoes.salas.map((s: { nome: string }) => s.nome)).toContain('Sala Verde');
    });

    it('respeita o intervalo entre reuniões, quando configurado', async () => {
      await ctx.database.pool.query(
        'update reserva.configuracoes set intervalo_entre_reunioes_minutos = 15',
      );
      await reservaDaAna('10:00', '11:00');
      expect(
        (await reservar(tokens.bruno, { horaInicio: '11:00', horaFim: '12:00' })).statusCode,
      ).toBe(409);
      expect(
        (await reservar(tokens.bruno, { horaInicio: '11:15', horaFim: '12:00' })).statusCode,
      ).toBe(201);
    });

    it('20 pedidos SIMULTÂNEOS para o mesmo horário: exatamente 1 é aceito', async () => {
      const usuarios = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          criarUsuarioTeste(ctx.database.pool, { nome: `Pessoa ${i}` }),
        ),
      );
      const tokensPessoas = await Promise.all(usuarios.map((u) => login(ctx.app, u)));

      const respostas = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          reservar(tokensPessoas[i % tokensPessoas.length]!, {
            horaInicio: '14:00',
            horaFim: '15:00',
            motivo: `Tentativa ${i}`,
          }),
        ),
      );

      const status = respostas.map((r) => r.statusCode);
      expect(status.filter((s) => s === 201)).toHaveLength(1);
      expect(status.filter((s) => s === 409)).toHaveLength(19);

      const { rows } = await ctx.database.pool.query(
        `select count(*)::int as n from reserva.reservas where status = 'ATIVA'`,
      );
      expect(rows[0].n).toBe(1);
    });
  });

  describe('edição', () => {
    it('o dono altera horário e motivo; a versão aumenta e a auditoria guarda antes/depois', async () => {
      const r = await reservaDaAna('10:00', '11:00');
      const res = await editar(tokens.ana, r.id, {
        salaId: azul.id,
        data: DIA(),
        horaInicio: '15:00',
        horaFim: '16:00',
        motivo: 'Reunião remarcada',
        participantes: 3,
        versao: 1,
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().reserva).toMatchObject({ motivo: 'Reunião remarcada', versao: 2 });

      const { rows } = await ctx.database.pool.query(
        `select acao, antes, depois from reserva.auditoria where acao = 'RESERVA_ALTERADA'`,
      );
      expect(rows[0].antes.motivo).toBe('Reunião de equipe');
      expect(rows[0].depois.motivo).toBe('Reunião remarcada');
    });

    it('recusa mudar para um horário ocupado (409)', async () => {
      const r = await reservaDaAna('10:00', '11:00');
      await reservar(tokens.bruno, { horaInicio: '14:00', horaFim: '15:00' });
      const res = await editar(tokens.ana, r.id, {
        salaId: azul.id,
        data: DIA(),
        horaInicio: '14:30',
        horaFim: '15:30',
        motivo: 'x x x',
        versao: 1,
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('RESERVA_CONFLITO');
    });

    it('pode estender a própria reserva sobre o horário dela mesma', async () => {
      const r = await reservaDaAna('10:00', '11:00');
      const res = await editar(tokens.ana, r.id, {
        salaId: azul.id,
        data: DIA(),
        horaInicio: '10:00',
        horaFim: '11:30',
        motivo: 'Reunião de equipe',
        participantes: 3,
        versao: 1,
      });
      expect(res.statusCode).toBe(200);
    });

    it('recusa edição feita sobre uma versão desatualizada (409)', async () => {
      const r = await reservaDaAna('10:00', '11:00');
      const base = { salaId: azul.id, data: DIA(), horaInicio: '10:00', horaFim: '11:00' };
      expect(
        (await editar(tokens.ana, r.id, { ...base, motivo: 'Primeira', versao: 1 })).statusCode,
      ).toBe(200);
      const res = await editar(tokens.ana, r.id, { ...base, motivo: 'Segunda', versao: 1 });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('RESERVA_ALTERADA');
    });

    it('outro colaborador não altera a reserva de alguém (403)', async () => {
      const r = await reservaDaAna();
      const res = await editar(tokens.bruno, r.id, {
        salaId: azul.id,
        data: DIA(),
        horaInicio: '10:00',
        horaFim: '11:00',
        motivo: 'Tomada',
        versao: 1,
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().reserva).toBeUndefined();
    });
  });

  describe('cancelamento', () => {
    it('o dono cancela; o histórico é preservado e o horário fica livre', async () => {
      const r = await reservaDaAna('10:00', '11:00');
      const res = await cancelar(tokens.ana, r.id);
      expect(res.statusCode).toBe(200);
      expect(res.json().reserva).toMatchObject({ status: 'CANCELADA', podeCancelar: false });

      const { rows } = await ctx.database.pool.query(
        'select status, cancelada_por, cancelada_em from reserva.reservas where id = $1',
        [r.id],
      );
      expect(rows[0]).toMatchObject({ status: 'CANCELADA', cancelada_por: ana.id });
      expect(rows[0].cancelada_em).toBeInstanceOf(Date);

      expect(
        (await reservar(tokens.bruno, { horaInicio: '10:00', horaFim: '11:00' })).statusCode,
      ).toBe(201);
      expect((await cancelar(tokens.ana, r.id)).statusCode).toBe(409);
    });

    it('outro colaborador não cancela (403)', async () => {
      const r = await reservaDaAna();
      expect((await cancelar(tokens.bruno, r.id)).statusCode).toBe(403);
    });

    it('o administrador cancela reserva de outra pessoa, desde que informe o motivo', async () => {
      const r = await reservaDaAna();
      const semMotivo = await cancelar(tokens.admin, r.id);
      expect(semMotivo.statusCode).toBe(400);
      const comMotivo = await cancelar(tokens.admin, r.id, 'Sala reservada para a diretoria');
      expect(comMotivo.statusCode).toBe(200);
      expect(comMotivo.json().reserva.motivoCancelamento).toBe('Sala reservada para a diretoria');
      const { rows } = await ctx.database.pool.query(
        `select ator_id from reserva.auditoria where acao = 'RESERVA_CANCELADA'`,
      );
      expect(rows[0].ator_id).toBe(admin.id);
    });

    it('reunião em andamento: o colaborador não altera mais; o administrador ainda pode', async () => {
      const r = await reservaDaAna();
      await ctx.database.pool.query(
        `update reserva.reservas
            set inicio = now() - interval '10 minutes', fim = now() + interval '50 minutes'
          where id = $1`,
        [r.id],
      );
      const doDono = await cancelar(tokens.ana, r.id);
      expect(doDono.statusCode).toBe(409);
      expect(doDono.json().error.message).toMatch(/já começou/);
      expect((await cancelar(tokens.admin, r.id, 'Encerrada antes')).statusCode).toBe(200);
    });

    it('não existe exclusão: DELETE responde 405', async () => {
      const r = await reservaDaAna();
      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/reservas/${r.id}`,
        ...comSessao(tokens.admin),
      });
      expect(res.statusCode).toBe(405);
    });
  });

  describe('consulta e privacidade', () => {
    it('lista reservas do período, com filtro por sala', async () => {
      await reservaDaAna('10:00', '11:00');
      await reservar(tokens.bruno, { salaId: verde.id, horaInicio: '10:00', horaFim: '11:00' });
      const todas = await ctx.app.inject({
        method: 'GET',
        url: `/api/reservas?dataInicio=${DIA()}&dataFim=${DIA()}`,
        ...comSessao(tokens.bruno),
      });
      expect(todas.json().reservas).toHaveLength(2);
      const soVerde = await ctx.app.inject({
        method: 'GET',
        url: `/api/reservas?dataInicio=${DIA()}&dataFim=${DIA()}&salaId=${verde.id}`,
        ...comSessao(tokens.bruno),
      });
      expect(soVerde.json().reservas).toHaveLength(1);
    });

    it('recusa consultas de mais de 62 dias', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/reservas?dataInicio=${DIA()}&dataFim=${somarDias(DIA(), 63)}`,
        ...comSessao(tokens.ana),
      });
      expect(res.statusCode).toBe(400);
    });

    it('por padrão, colaboradores veem o motivo das reuniões dos outros', async () => {
      const r = await reservaDaAna();
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/reservas/${r.id}`,
        ...comSessao(tokens.bruno),
      });
      expect(res.json().reserva).toMatchObject({
        motivo: 'Reunião de equipe',
        motivoOculto: false,
        podeEditar: false,
      });
    });

    it('com o motivo configurado como privado, a API não envia o texto a outros colaboradores', async () => {
      const r = await reservaDaAna();
      await ctx.database.pool.query(
        'update reserva.configuracoes set motivo_visivel_para_todos = false',
      );
      const get = (token: string) =>
        ctx.app.inject({ method: 'GET', url: `/api/reservas/${r.id}`, ...comSessao(token) });

      const deBruno = await get(tokens.bruno);
      expect(deBruno.json().reserva).toMatchObject({ motivo: 'Reservado', motivoOculto: true });
      expect(deBruno.body).not.toContain('Reunião de equipe');
      expect((await get(tokens.ana)).json().reserva.motivo).toBe('Reunião de equipe');
      expect((await get(tokens.admin)).json().reserva.motivo).toBe('Reunião de equipe');
    });

    it('colaborador não lista reservas de outra pessoa por responsável nem as canceladas alheias', async () => {
      await reservaDaAna();
      const get = (query: string, token: string) =>
        ctx.app.inject({
          method: 'GET',
          url: `/api/reservas?dataInicio=${DIA()}&dataFim=${DIA()}&${query}`,
          ...comSessao(token),
        });
      expect((await get(`usuarioId=${ana.id}`, tokens.bruno)).statusCode).toBe(403);
      expect((await get('incluirCanceladas=true', tokens.bruno)).statusCode).toBe(403);
      // Para si mesmo, pode; o administrador pode tudo.
      expect(
        (await get(`usuarioId=${bruno.id}&incluirCanceladas=true`, tokens.bruno)).statusCode,
      ).toBe(200);
      expect(
        (await get(`usuarioId=${ana.id}&incluirCanceladas=true`, tokens.admin)).statusCode,
      ).toBe(200);
    });

    it('o motivo do cancelamento só aparece para o responsável e o administrador', async () => {
      const r = await reservaDaAna();
      expect(
        (await cancelar(tokens.admin, r.id, 'Sala necessária para a diretoria')).statusCode,
      ).toBe(200);
      const get = (token: string) =>
        ctx.app.inject({ method: 'GET', url: `/api/reservas/${r.id}`, ...comSessao(token) });
      expect((await get(tokens.bruno)).json().reserva.motivoCancelamento).toBeNull();
      expect((await get(tokens.ana)).json().reserva.motivoCancelamento).toBe(
        'Sala necessária para a diretoria',
      );
      expect((await get(tokens.admin)).json().reserva.motivoCancelamento).toBe(
        'Sala necessária para a diretoria',
      );
    });

    it('"minhas reservas" traz só as da pessoa', async () => {
      await reservaDaAna('10:00', '11:00');
      await reservar(tokens.bruno, { horaInicio: '12:00', horaFim: '13:00' });
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/reservas/minhas?tipo=proximas',
        ...comSessao(tokens.ana),
      });
      const reservas = res.json().reservas;
      expect(reservas).toHaveLength(1);
      expect(reservas[0].responsavel.id).toBe(ana.id);
    });

    it('configurações de funcionamento ficam disponíveis para a tela', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/configuracoes',
        ...comSessao(tokens.ana),
      });
      expect(res.json().configuracoes).toMatchObject({
        horarioInicio: '07:00',
        horarioFim: '20:00',
        granularidadeMinutos: 15,
        antecedenciaMaximaDias: 120,
        motivoVisivelParaTodos: true,
      });
    });
  });
});
