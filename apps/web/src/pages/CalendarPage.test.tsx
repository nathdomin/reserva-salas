import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN,
  COLABORADOR,
  logadoComo,
  mockApi,
  reservaMock,
  SALA_AZUL,
  SALA_VERDE,
} from '../test/mock-api';
import { renderApp } from '../test/render';

// "Agora" fixo: terça, 01/12/2026, 09:00 em Brasília (o relógio continua andando).
const AGORA = new Date('2026-12-01T12:00:00.000Z');

const SEMANA = 'GET /api/reservas?dataInicio=2026-11-30&dataFim=2026-12-06';
const PROXIMA_SEMANA = 'GET /api/reservas?dataInicio=2026-12-07&dataFim=2026-12-13';
const DIA = 'GET /api/reservas?dataInicio=2026-12-01&dataFim=2026-12-01';
const MES = 'GET /api/reservas?dataInicio=2026-11-30&dataFim=2027-01-03';

// Minha: Sala Azul, 01/12 10:00–11:00. De outra pessoa: Sala Verde, 03/12 14:00–14:30.
const MINHA = reservaMock();
const DE_OUTRA = reservaMock({
  id: 'ee000000-0000-4000-8000-000000000002',
  motivo: 'Daily do time',
  sala: { id: SALA_VERDE.id, nome: SALA_VERDE.nome, localizacao: SALA_VERDE.localizacao },
  responsavel: { id: ADMIN.id, nome: ADMIN.nome },
  inicio: '2026-12-03T17:00:00.000Z',
  fim: '2026-12-03T17:30:00.000Z',
});

function rotas(extra: Parameters<typeof mockApi>[0] = {}) {
  return {
    ...logadoComo(COLABORADOR),
    'GET /api/salas': { body: { salas: [SALA_AZUL, SALA_VERDE] } },
    [SEMANA]: { body: { reservas: [MINHA, DE_OUTRA] } },
    [PROXIMA_SEMANA]: { body: { reservas: [] } },
    [DIA]: { body: { reservas: [MINHA] } },
    [MES]: { body: { reservas: [MINHA, DE_OUTRA] } },
    ...extra,
  };
}

const temTitulo = (texto: string) =>
  expect(screen.getByRole('heading', { level: 2, name: texto })).toBeTruthy();

describe('calendário', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(AGORA);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('abre na semana atual, com as reservas e a legenda', async () => {
    mockApi(rotas());
    renderApp('/calendario');
    expect(await screen.findByText('2 reservas neste período.')).toBeTruthy();
    temTitulo('30 de novembro a 6 de dezembro de 2026');

    const minha = screen.getByRole('link', {
      name: '10:00 às 11:00, Sala Azul, Planejamento mensal, Caio Colaborador, sua reserva',
    });
    expect(minha.getAttribute('href')).toBe(`/reservas/${MINHA.id}`);
    const outra = screen.getByRole('link', {
      name: '14:00 às 14:30, Sala Verde, Daily do time, Ana Admin',
    });
    expect(outra.getAttribute('href')).toBe(`/reservas/${DE_OUTRA.id}`);

    const legenda = screen.getByRole('list', { name: 'Legenda' });
    for (const item of ['Livre (toque ou clique para reservar)', 'Ocupado', 'Sua reserva']) {
      expect(legenda.textContent).toContain(item);
    }
  });

  it('horário livre leva ao formulário já preenchido; horário passado não', async () => {
    mockApi(rotas());
    renderApp('/calendario');
    await screen.findByText('2 reservas neste período.');

    const livre = screen.getByRole('link', { name: 'Reservar Ter., 01/12 às 14:00' });
    expect(livre.getAttribute('href')).toBe('/reservas/nova?data=2026-12-01&inicio=14%3A00');
    // 08:00 de hoje e toda a segunda (30/11) já passaram.
    expect(screen.queryByRole('link', { name: 'Reservar Ter., 01/12 às 08:00' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reservar Seg., 30/11 às 14:00' })).toBeNull();
  });

  it('navega entre as semanas e volta para hoje', async () => {
    mockApi(rotas());
    renderApp('/calendario');
    await screen.findByText('2 reservas neste período.');

    fireEvent.click(screen.getByRole('button', { name: 'Próximo período' }));
    expect(
      await screen.findByText('Nenhuma reserva neste período: todos os horários estão livres.'),
    ).toBeTruthy();
    temTitulo('7 a 13 de dezembro de 2026');

    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(await screen.findByText('2 reservas neste período.')).toBeTruthy();
    temTitulo('30 de novembro a 6 de dezembro de 2026');
  });

  it('visão do dia: uma coluna por sala; horário ocupado não é oferecido', async () => {
    mockApi(rotas());
    renderApp('/calendario?visao=dia&data=2026-12-01');
    expect(await screen.findByText('1 reserva neste período.')).toBeTruthy();
    temTitulo('Terça-feira, 1 de dezembro de 2026');

    expect(
      screen.queryByRole('link', { name: 'Reservar Ter., 01/12 às 10:00, Sala Azul' }),
    ).toBeNull();
    const verde = screen.getByRole('link', { name: 'Reservar Ter., 01/12 às 10:00, Sala Verde' });
    expect(verde.getAttribute('href')).toBe(
      `/reservas/nova?data=2026-12-01&inicio=10%3A00&salaId=${SALA_VERDE.id}`,
    );
    expect(
      screen.getByRole('link', { name: 'Reservar Ter., 01/12 às 11:00, Sala Azul' }),
    ).toBeTruthy();
  });

  it('filtra por sala', async () => {
    const fetchMock = mockApi(
      rotas({ [`${SEMANA}&salaId=${SALA_VERDE.id}`]: { body: { reservas: [DE_OUTRA] } } }),
    );
    renderApp('/calendario');
    await screen.findByText('2 reservas neste período.');

    fireEvent.change(screen.getByLabelText('Sala'), { target: { value: SALA_VERDE.id } });
    expect(await screen.findByText('1 reserva neste período.')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith(`salaId=${SALA_VERDE.id}`)),
    ).toBe(true);
  });

  it('visão do mês: identifica os dias com reuniões e abre o dia ao clicar', async () => {
    mockApi(rotas());
    renderApp('/calendario?visao=mes&data=2026-12-15');
    expect(await screen.findByText('2 reservas neste período.')).toBeTruthy();
    temTitulo('Dezembro de 2026');
    // No mês não há horários livres nem sombreado: a legenda mostra só os tipos de reserva.
    const legenda = screen.getByRole('list', { name: 'Legenda' }).textContent;
    expect(legenda).toContain('Sua reserva');
    expect(legenda).not.toContain('Livre');

    expect(
      screen.getByRole('link', { name: 'quarta-feira, 2 de dezembro: sem reservas' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'terça-feira, 1 de dezembro: 1 reserva' }));
    expect(await screen.findByText('1 reserva neste período.')).toBeTruthy();
    temTitulo('Terça-feira, 1 de dezembro de 2026');
  });
});
