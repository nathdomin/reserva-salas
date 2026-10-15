import { fireEvent, screen, within } from '@testing-library/react';
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

  it('abre na semana atual da primeira sala, com as reservas e a legenda', async () => {
    mockApi(rotas());
    renderApp('/calendario');
    expect(await screen.findByText('1 reserva neste período.')).toBeTruthy();
    temTitulo('30 de novembro a 6 de dezembro de 2026');

    // Uma sala por vez: a primeira já vem escolhida e a reserva da outra sala não aparece.
    const abas = screen.getByRole('group', { name: 'Sala' });
    expect(
      within(abas).getByRole('button', { name: 'Sala Azul' }).getAttribute('aria-pressed'),
    ).toBe('true');
    const minha = screen.getByRole('link', {
      name: '10:00 às 11:00, Planejamento mensal, Caio Colaborador, sua reserva',
    });
    expect(minha.getAttribute('href')).toBe(`/reservas/${MINHA.id}`);
    expect(screen.queryByRole('link', { name: /Daily do time/ })).toBeNull();

    const legenda = screen.getByRole('list', { name: 'Legenda' });
    for (const item of ['Livre (toque ou clique para reservar)', 'Ocupado', 'Sua reserva']) {
      expect(legenda.textContent).toContain(item);
    }
  });

  it('horário livre leva ao formulário já preenchido; horário passado não', async () => {
    mockApi(rotas());
    renderApp('/calendario');
    await screen.findByText('1 reserva neste período.');

    const livre = screen.getByRole('link', { name: 'Reservar Ter., 01/12 às 14:00' });
    expect(livre.getAttribute('href')).toBe(
      `/reservas/nova?data=2026-12-01&inicio=14%3A00&salaId=${SALA_AZUL.id}`,
    );
    // 08:00 de hoje e toda a segunda (30/11) já passaram.
    expect(screen.queryByRole('link', { name: 'Reservar Ter., 01/12 às 08:00' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reservar Seg., 30/11 às 14:00' })).toBeNull();
  });

  it('navega entre as semanas e volta para hoje', async () => {
    mockApi(rotas());
    renderApp('/calendario');
    await screen.findByText('1 reserva neste período.');

    fireEvent.click(screen.getByRole('button', { name: 'Próximo período' }));
    expect(
      await screen.findByText('Nenhuma reserva neste período: todos os horários estão livres.'),
    ).toBeTruthy();
    temTitulo('7 a 13 de dezembro de 2026');

    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(await screen.findByText('1 reserva neste período.')).toBeTruthy();
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

  it('semana: troca de sala pelas abas', async () => {
    const fetchMock = mockApi(
      rotas({ [`${SEMANA}&salaId=${SALA_VERDE.id}`]: { body: { reservas: [DE_OUTRA] } } }),
    );
    renderApp('/calendario');
    await screen.findByText('1 reserva neste período.');

    const abas = screen.getByRole('group', { name: 'Sala' });
    fireEvent.click(within(abas).getByRole('button', { name: 'Sala Verde' }));
    expect(await screen.findByRole('link', { name: /Daily do time/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Planejamento mensal/ })).toBeNull();
    expect(
      within(abas).getByRole('button', { name: 'Sala Verde' }).getAttribute('aria-pressed'),
    ).toBe('true');
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

  it('agenda (celular): lista do dia por sala, com os horários livres para reservar', async () => {
    mockApi(rotas());
    renderApp('/calendario?visao=agenda');
    expect(await screen.findByText('1 reserva neste dia.')).toBeTruthy();
    temTitulo('Terça-feira, 1 de dezembro de 2026');

    // Agora são 09:00: livre até a reunião das 10:00 e depois dela.
    expect(screen.getByText(/Livres agora/).parentElement?.textContent).toBe(
      'Livres agora: Sala Azul (até 10:00), Sala Verde (até 20:00)',
    );
    const livre = screen.getByRole('link', { name: 'Reservar Sala Azul às 09:00' });
    expect(livre.getAttribute('href')).toBe(
      `/reservas/nova?data=2026-12-01&inicio=09%3A00&salaId=${SALA_AZUL.id}`,
    );
    expect(screen.getByRole('link', { name: 'Reservar Sala Azul às 11:00' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Reservar Sala Azul às 10:00' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reservar Sala Azul às 07:00' })).toBeNull();
    const minha = screen.getByRole('link', { name: /Planejamento mensal/ });
    expect(minha.getAttribute('href')).toBe(`/reservas/${MINHA.id}`);
    expect(minha.textContent).toContain('Sua reserva');

    // Outro dia da semana: troca sem nova busca (a Agenda já trouxe a semana inteira).
    fireEvent.click(screen.getByRole('link', { name: 'Qui. 3: 1 reserva' }));
    temTitulo('Quinta-feira, 3 de dezembro de 2026');
    expect(screen.getByRole('link', { name: /Daily do time/ }).textContent).toContain('Ocupado');
    expect(screen.getByRole('link', { name: 'Reservar Sala Verde às 07:00' })).toBeTruthy();
    expect(screen.queryByText(/Livres agora/)).toBeNull();
  });
});
