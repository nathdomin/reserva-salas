import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COLABORADOR,
  logadoComo,
  mockApi,
  reservaMock,
  SALA_AZUL,
  SALA_VERDE,
} from '../test/mock-api';
import { renderApp } from '../test/render';

const base = logadoComo(COLABORADOR);

describe('Início', () => {
  it('cumprimenta pelo primeiro nome', async () => {
    mockApi(logadoComo(COLABORADOR));
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Olá, Caio' })).toBeTruthy();
  });

  it('mostra servidor e banco conectados quando a API responde 200', async () => {
    mockApi(logadoComo(COLABORADOR));
    renderApp('/');
    expect(await screen.findByText('Conectado')).toBeTruthy();
    expect(screen.getByText('Respondendo')).toBeTruthy();
  });

  it('mostra o banco como indisponível quando a API responde 503', async () => {
    mockApi({
      ...base,
      'GET /api/health': {
        status: 503,
        body: { status: 'degraded', database: 'indisponivel', timestamp: '2026-10-09T12:30:00Z' },
      },
    });
    renderApp('/');
    expect(await screen.findByText('Indisponível')).toBeTruthy();
    expect(screen.getByText(/painel do Supabase/)).toBeTruthy();
  });

  it('mostra erro com opção de tentar de novo quando a verificação não responde', async () => {
    mockApi({
      ...base,
      'GET /api/health': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderApp('/');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'O servidor da aplicação não respondeu',
    );
    expect(screen.getByRole('button', { name: 'Verificar de novo' })).toBeTruthy();
  });

  it('mostra o estado vazio das próximas reuniões com atalho para reservar', async () => {
    mockApi(logadoComo(COLABORADOR));
    renderApp('/');
    expect(await screen.findByText('Nenhuma reunião agendada')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Reservar uma sala' }).getAttribute('href')).toBe(
      '/reservas/nova',
    );
  });

  it('lista as próximas reuniões da pessoa, com link para os detalhes', async () => {
    mockApi({
      ...base,
      'GET /api/reservas/minhas?tipo=proximas&limite=6': {
        body: { reservas: [reservaMock()] },
      },
    });
    renderApp('/');
    const lista = await screen.findByRole('list', { name: 'Próximas reuniões' });
    const link = lista.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(`/reservas/${reservaMock().id}`);
    expect(link.textContent).toContain('Planejamento mensal');
    expect(link.textContent).toContain('10:00 às 11:00');
    expect(link.textContent).toContain('Sala Azul');
  });

  describe('painel de hoje', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('destaca a próxima reunião, as salas livres agora e os números do dia', async () => {
      // Terça, 01/12/2026, 09:00 em Brasília; a reunião (Sala Azul) é das 10:00 às 11:00.
      vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-12-01T12:00:00.000Z'));
      const reserva = reservaMock({
        inicio: '2026-12-01T13:00:00.000Z',
        fim: '2026-12-01T14:00:00.000Z',
      });
      mockApi({
        ...logadoComo(COLABORADOR),
        'GET /api/reservas/minhas?tipo=proximas&limite=6': { body: { reservas: [reserva] } },
        'GET /api/salas': { body: { salas: [SALA_AZUL, SALA_VERDE] } },
        'GET /api/reservas?dataInicio=2026-12-01&dataFim=2026-12-01': {
          body: { reservas: [reserva] },
        },
      });
      renderApp('/');

      const destaque = (await screen.findByRole('heading', { name: 'Sua próxima reunião' }))
        .parentElement!;
      expect(destaque.textContent).toContain('10:00');
      expect(destaque.textContent).toContain('Planejamento mensal');
      expect(destaque.textContent).toContain('começa em 1 h');
      expect(
        within(destaque).getByRole('link', { name: 'Ver detalhes' }).getAttribute('href'),
      ).toBe(`/reservas/${reserva.id}`);

      const livres = screen.getByRole('heading', { name: 'Livres agora' }).closest('section')!;
      expect(await within(livres).findByText('livre até 10:00')).toBeTruthy();
      expect(within(livres).getByText('livre até 20:00')).toBeTruthy();
      expect(
        within(livres)
          .getByRole('link', { name: 'Reservar Sala Verde às 09:00' })
          .getAttribute('href'),
      ).toBe(`/reservas/nova?data=2026-12-01&inicio=09%3A00&salaId=${SALA_VERDE.id}`);

      const numero = (rotulo: string) => screen.getByText(rotulo).nextElementSibling?.textContent;
      expect(numero('reuniões suas hoje')).toBe('1');
      expect(numero('salas livres agora')).toBe('2');
      expect(numero('reservas hoje no total')).toBe('1');
      expect(numero('salas disponíveis')).toBe('2');
    });
  });
});
