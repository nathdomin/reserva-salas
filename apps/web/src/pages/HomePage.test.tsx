import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COLABORADOR, logadoComo, mockApi, reservaMock } from '../test/mock-api';
import { renderApp } from '../test/render';

const base = logadoComo(COLABORADOR);

describe('Início', () => {
  it('cumprimenta pelo primeiro nome', async () => {
    mockApi(logadoComo(COLABORADOR));
    renderApp('/');
    expect(await screen.findByText(/Olá, Caio\./)).toBeTruthy();
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
});
