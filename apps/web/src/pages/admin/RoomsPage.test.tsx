import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ADMIN,
  corpoEnviado,
  logadoComo,
  mockApi,
  SALA_AZUL,
  SALA_VERDE,
} from '../../test/mock-api';
import { renderApp } from '../../test/render';

const LISTA = 'GET /api/salas?incluirInativas=true';

async function abrir() {
  renderApp('/admin/salas');
  return screen.findByRole('list', { name: 'Lista de salas' });
}

describe('Salas (administrador)', () => {
  it('lista as salas com capacidade e recursos', async () => {
    mockApi({
      ...logadoComo(ADMIN),
      [LISTA]: { body: { salas: [SALA_AZUL, { ...SALA_VERDE, ativo: false }] } },
    });
    const lista = await abrir();
    expect(lista.textContent).toContain('Sala Azul');
    expect(lista.textContent).toContain('Até 8 pessoas');
    expect(lista.textContent).toContain('Televisão');
    expect(within(lista).getByText('Desativada')).toBeTruthy();
  });

  it('cadastra uma sala juntando os recursos marcados e os digitados', async () => {
    const fetchMock = mockApi({
      ...logadoComo(ADMIN),
      [LISTA]: { body: { salas: [] } },
      'POST /api/admin/salas': { status: 201, body: { sala: { ...SALA_AZUL, nome: 'Sala Nova' } } },
    });
    renderApp('/admin/salas');
    await screen.findByText('Nenhuma sala cadastrada');

    fireEvent.click(screen.getByRole('button', { name: 'Nova sala' }));
    fireEvent.change(screen.getByLabelText('Nome da sala'), { target: { value: 'Sala Nova' } });
    fireEvent.change(screen.getByLabelText('Localização ou andar'), {
      target: { value: '4º andar' },
    });
    fireEvent.change(screen.getByLabelText('Capacidade (pessoas)'), { target: { value: '12' } });
    fireEvent.click(screen.getByLabelText('Projetor'));
    fireEvent.click(screen.getByLabelText('Videoconferência'));
    fireEvent.change(screen.getByLabelText('Outros recursos'), {
      target: { value: 'Flipchart, Cadeiras extras' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar sala' }));

    expect(await screen.findByText(/Sala Nova cadastrada/)).toBeTruthy();
    expect(corpoEnviado(fetchMock, 'POST /api/admin/salas')).toEqual({
      nome: 'Sala Nova',
      localizacao: '4º andar',
      capacidade: 12,
      recursos: ['Projetor', 'Videoconferência', 'Flipchart', 'Cadeiras extras'],
      descricao: null,
    });
  });

  it('desativar com reservas futuras pergunta o que fazer e envia a decisão', async () => {
    let chamadas = 0;
    const fetchMock = mockApi({
      ...logadoComo(ADMIN),
      [LISTA]: { body: { salas: [SALA_AZUL] } },
      [`PATCH /api/admin/salas/${SALA_AZUL.id}`]: ({ body }) => {
        chamadas += 1;
        if (!(body as { reservasFuturas?: string }).reservasFuturas) {
          return {
            status: 409,
            body: {
              error: {
                code: 'SALA_COM_RESERVAS_FUTURAS',
                message: 'Esta sala tem 1 reserva(s) futura(s).',
                details: {
                  total: 1,
                  reservas: [
                    {
                      id: 'ee000000-0000-4000-8000-000000000001',
                      inicio: '2026-12-01T13:00:00.000Z',
                      fim: '2026-12-01T14:00:00.000Z',
                      responsavel: 'Caio Colaborador',
                    },
                  ],
                },
              },
            },
          };
        }
        return { body: { sala: { ...SALA_AZUL, ativo: false }, reservasCanceladas: 1 } };
      },
    });
    const lista = await abrir();
    fireEvent.click(within(lista).getByRole('button', { name: 'Desativar' }));
    expect(chamadas).toBe(0); // primeiro pede confirmação
    fireEvent.click(within(lista).getByRole('button', { name: 'Confirmar desativação' }));

    expect(await screen.findByText(/1 reserva\(s\) futura\(s\)/)).toBeTruthy();
    expect(screen.getByText(/Caio Colaborador/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Desativar e cancelar as reservas' }));
    expect(
      await screen.findByText(/desativada e 1 reserva\(s\) futura\(s\) cancelada/),
    ).toBeTruthy();
    expect(corpoEnviado(fetchMock, `PATCH /api/admin/salas/${SALA_AZUL.id}`)).toEqual({
      ativo: false,
      reservasFuturas: 'cancelar',
    });
  });
});
