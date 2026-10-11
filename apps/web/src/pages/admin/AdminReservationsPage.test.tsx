import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN,
  COLABORADOR,
  corpoEnviado,
  logadoComo,
  mockApi,
  reservaMock,
  SALA_AZUL,
  SALA_VERDE,
  usuarioAdmin,
} from '../../test/mock-api';
import { renderApp } from '../../test/render';

// Hoje = 09/10/2026: o filtro padrão vai de hoje até 30 dias depois.
const PADRAO = 'GET /api/reservas?dataInicio=2026-10-09&dataFim=2026-11-08';
const RESERVA = reservaMock({ podeEditar: true, podeCancelar: true });

function rotas(extra: Parameters<typeof mockApi>[0] = {}) {
  return {
    ...logadoComo(ADMIN),
    'GET /api/salas?incluirInativas=true': {
      body: { salas: [SALA_AZUL, { ...SALA_VERDE, ativo: false }] },
    },
    'GET /api/admin/usuarios': {
      body: { usuarios: [usuarioAdmin(ADMIN), usuarioAdmin(COLABORADOR)] },
    },
    [PADRAO]: { body: { reservas: [RESERVA] } },
    ...extra,
  };
}

describe('reservas (administrador)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-09T15:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lista as reservas de todas as pessoas, com o responsável', async () => {
    mockApi(rotas());
    renderApp('/admin/reservas');
    const lista = await screen.findByRole('list', { name: 'Reservas encontradas' });
    expect(screen.getByText('1 reserva encontrada.')).toBeTruthy();
    expect(lista.textContent).toContain('Caio Colaborador');
    expect(lista.textContent).toContain('Planejamento mensal');
    // Sala desativada continua disponível no filtro (histórico preservado).
    expect(screen.getByRole('option', { name: 'Sala Verde (desativada)' })).toBeTruthy();
  });

  it('filtra por responsável e inclui canceladas', async () => {
    const chave = `${PADRAO}&usuarioId=${COLABORADOR.id}&incluirCanceladas=true`;
    const fetchMock = mockApi(rotas({ [chave]: { body: { reservas: [] } } }));
    renderApp('/admin/reservas');
    await screen.findByRole('list', { name: 'Reservas encontradas' });

    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: COLABORADOR.id } });
    fireEvent.click(screen.getByLabelText('Incluir canceladas'));
    expect(await screen.findByText('Nenhuma reserva com esses filtros')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === chave.slice(4))).toBe(true);
  });

  it('período inválido mostra o erro e não consulta', async () => {
    const fetchMock = mockApi(rotas());
    renderApp('/admin/reservas');
    await screen.findByRole('list', { name: 'Reservas encontradas' });

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-01' } });
    expect(
      await screen.findByText('A data final deve ser igual ou posterior à inicial.'),
    ).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('dataFim=2026-10-01'))).toBe(
      false,
    );
  });

  it('cancela a reserva de outra pessoa informando o motivo', async () => {
    const fetchMock = mockApi(
      rotas({
        [`POST /api/reservas/${RESERVA.id}/cancelar`]: {
          body: { reserva: { ...RESERVA, status: 'CANCELADA' } },
        },
      }),
    );
    renderApp('/admin/reservas');
    const lista = await screen.findByRole('list', { name: 'Reservas encontradas' });

    fireEvent.click(within(lista).getByRole('button', { name: /^Cancelar: Planejamento/ }));
    fireEvent.change(screen.getByLabelText('Motivo do cancelamento (obrigatório)'), {
      target: { value: 'Sala necessária para a diretoria' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));

    expect(
      await screen.findByText('Reserva de Caio Colaborador cancelada. O horário ficou livre.'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(corpoEnviado(fetchMock, `POST /api/reservas/${RESERVA.id}/cancelar`)).toEqual({
        motivo: 'Sala necessária para a diretoria',
      }),
    );
  });
});
