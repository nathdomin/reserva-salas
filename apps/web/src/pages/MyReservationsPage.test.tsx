import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COLABORADOR, corpoEnviado, logadoComo, mockApi, reservaMock } from '../test/mock-api';
import { renderApp } from '../test/render';

const PROXIMAS = 'GET /api/reservas/minhas?tipo=proximas&limite=20';
const ANTERIORES = 'GET /api/reservas/minhas?tipo=anteriores&limite=20';

const ATIVA = reservaMock();
const CANCELADA = reservaMock({
  id: 'ee000000-0000-4000-8000-000000000003',
  motivo: 'Treinamento',
  status: 'CANCELADA',
  canceladaEm: '2026-10-01T12:00:00.000Z',
  motivoCancelamento: 'Mudança de agenda',
  podeEditar: false,
  podeCancelar: false,
});

describe('minhas reservas', () => {
  it('lista as próximas com data, horário, sala, motivo, situação e ações', async () => {
    mockApi({ ...logadoComo(COLABORADOR), [PROXIMAS]: { body: { reservas: [ATIVA] } } });
    renderApp('/minhas-reservas');
    const lista = await screen.findByRole('list', { name: 'Próximas reservas' });
    for (const texto of [
      'Ter., 01/12',
      '10:00 às 11:00',
      'Sala Azul',
      'Planejamento mensal',
      'Ativa',
    ]) {
      expect(lista.textContent).toContain(texto);
    }
    expect(
      within(lista)
        .getByRole('link', { name: /^Editar: Planejamento mensal/ })
        .getAttribute('href'),
    ).toBe(`/reservas/${ATIVA.id}/editar`);
  });

  it('a aba "Anteriores e canceladas" mostra o histórico, sem ações de alteração', async () => {
    mockApi({
      ...logadoComo(COLABORADOR),
      [PROXIMAS]: { body: { reservas: [] } },
      [ANTERIORES]: { body: { reservas: [CANCELADA] } },
    });
    renderApp('/minhas-reservas');
    expect(await screen.findByText('Nenhuma reunião agendada')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Anteriores e canceladas' }));
    const lista = await screen.findByRole('list', { name: 'Reservas anteriores' });
    expect(lista.textContent).toContain('Cancelada: Mudança de agenda');
    expect(within(lista).queryByRole('button', { name: /^Cancelar/ })).toBeNull();
    expect(within(lista).queryByRole('link', { name: /^Editar/ })).toBeNull();
    expect(
      screen.getByRole('tab', { name: 'Anteriores e canceladas' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('cancela pela lista, com confirmação', async () => {
    const fetchMock = mockApi({
      ...logadoComo(COLABORADOR),
      [PROXIMAS]: { body: { reservas: [ATIVA] } },
      [`POST /api/reservas/${ATIVA.id}/cancelar`]: {
        body: {
          reserva: { ...ATIVA, status: 'CANCELADA', podeEditar: false, podeCancelar: false },
        },
      },
    });
    renderApp('/minhas-reservas');
    const lista = await screen.findByRole('list', { name: 'Próximas reservas' });

    fireEvent.click(within(lista).getByRole('button', { name: /^Cancelar: Planejamento mensal/ }));
    expect(corpoEnviado(fetchMock, `POST /api/reservas/${ATIVA.id}/cancelar`)).toBeUndefined();
    expect(screen.getByLabelText('Motivo do cancelamento (opcional)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));

    expect(await screen.findByText(/Reserva cancelada\. O horário ficou livre/)).toBeTruthy();
    expect(corpoEnviado(fetchMock, `POST /api/reservas/${ATIVA.id}/cancelar`)).toEqual({});
  });
});
