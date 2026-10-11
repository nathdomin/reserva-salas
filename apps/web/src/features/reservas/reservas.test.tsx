import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ADMIN,
  COLABORADOR,
  corpoEnviado,
  logadoComo,
  mockApi,
  reservaMock,
  SALA_AZUL,
  SALA_VERDE,
} from '../../test/mock-api';
import { renderApp } from '../../test/render';

const DATA = '2026-12-01';
const OCUPACAO = `GET /api/reservas?dataInicio=${DATA}&dataFim=${DATA}&salaId=${SALA_AZUL.id}`;
const OCUPACAO_VERDE = `GET /api/reservas?dataInicio=${DATA}&dataFim=${DATA}&salaId=${SALA_VERDE.id}`;

function rotasNovaReserva(extra: Parameters<typeof mockApi>[0] = {}) {
  return {
    ...logadoComo(COLABORADOR),
    'GET /api/salas': { body: { salas: [SALA_AZUL, SALA_VERDE] } },
    [OCUPACAO]: { body: { reservas: [] } },
    [OCUPACAO_VERDE]: { body: { reservas: [] } },
    ...extra,
  };
}

async function abrirNovaReserva() {
  renderApp(`/reservas/nova?salaId=${SALA_AZUL.id}&data=${DATA}&inicio=10:00`);
  await screen.findByRole('button', { name: /Confirmar reserva/ });
}

// Só campos de formulário: o logotipo também tem aria-label "Início" (link para a tela inicial).
const CAMPOS = 'input, select, textarea';

function campo(rotulo: string) {
  return screen.getByLabelText(rotulo, { selector: CAMPOS }) as
    HTMLInputElement | HTMLSelectElement;
}

describe('nova reserva', () => {
  it('preenche com os parâmetros da URL e envia os dados certos', async () => {
    const criada = reservaMock();
    const fetchMock = mockApi(
      rotasNovaReserva({
        'POST /api/reservas': { status: 201, body: { reserva: criada } },
        [`GET /api/reservas/${criada.id}`]: { body: { reserva: criada } },
      }),
    );
    const { location } = renderApp(
      `/reservas/nova?salaId=${SALA_AZUL.id}&data=${DATA}&inicio=10:00`,
    );
    await screen.findByRole('button', { name: /Confirmar reserva/ });

    expect(campo('Sala').value).toBe(SALA_AZUL.id);
    expect(campo('Data').value).toBe(DATA);
    expect(campo('Início').value).toBe('10:00');
    expect(campo('Término').value).toBe('11:00');
    expect(screen.getByText('Responsável').parentElement?.textContent).toContain(
      'Caio Colaborador',
    );

    fireEvent.change(campo('Término'), { target: { value: '11:30' } });
    fireEvent.change(campo('Motivo da reunião'), { target: { value: 'Planejamento mensal' } });
    fireEvent.change(campo('Participantes (opcional)'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar reserva/ }));

    expect(await screen.findByText('Reserva confirmada.')).toBeTruthy();
    expect(location.pathname).toBe(`/reservas/${criada.id}`);
    expect(corpoEnviado(fetchMock, 'POST /api/reservas')).toEqual({
      salaId: SALA_AZUL.id,
      data: DATA,
      diaInteiro: false,
      horaInicio: '10:00',
      horaFim: '11:30',
      motivo: 'Planejamento mensal',
      participantes: 5,
    });
  });

  it('mostra os horários já ocupados da sala no dia escolhido', async () => {
    mockApi(
      rotasNovaReserva({
        [OCUPACAO]: {
          body: {
            reservas: [
              reservaMock({
                motivo: 'Daily do time',
                responsavel: { id: ADMIN.id, nome: 'Ana Admin' },
              }),
            ],
          },
        },
      }),
    );
    await abrirNovaReserva();
    const lista = await screen.findByRole('list', { name: 'Horários ocupados' });
    expect(lista.textContent).toContain('10:00 às 11:00');
    expect(lista.textContent).toContain('Daily do time');
    expect(lista.textContent).toContain('Ana Admin');
  });

  it('"Dia inteiro" esconde os horários e envia a reserva do dia todo', async () => {
    const fetchMock = mockApi(
      rotasNovaReserva({
        'POST /api/reservas': { status: 400, body: { error: { code: 'X', message: 'Parada.' } } },
      }),
    );
    await abrirNovaReserva();
    fireEvent.click(screen.getByLabelText('Dia inteiro'));
    expect(screen.queryByLabelText('Início', { selector: CAMPOS })).toBeNull();
    fireEvent.change(campo('Motivo da reunião'), { target: { value: 'Treinamento anual' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar reserva/ }));
    await screen.findByText('Parada.');
    expect(corpoEnviado(fetchMock, 'POST /api/reservas')).toEqual({
      salaId: SALA_AZUL.id,
      data: DATA,
      diaInteiro: true,
      motivo: 'Treinamento anual',
      participantes: null,
    });
  });

  it('valida antes de enviar (motivo e capacidade da sala)', async () => {
    const fetchMock = mockApi(rotasNovaReserva());
    await abrirNovaReserva();
    fireEvent.change(campo('Sala'), { target: { value: SALA_VERDE.id } });
    fireEvent.change(campo('Participantes (opcional)'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar reserva/ }));
    expect(await screen.findByText(/Descreva o motivo/)).toBeTruthy();

    fireEvent.change(campo('Motivo da reunião'), { target: { value: 'Reunião rápida' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar reserva/ }));
    expect(await screen.findByText('A sala Sala Verde comporta até 4 pessoa(s).')).toBeTruthy();
    expect(corpoEnviado(fetchMock, 'POST /api/reservas')).toBeUndefined();
  });

  it('em conflito, explica e oferece horários e salas livres com um clique', async () => {
    mockApi(
      rotasNovaReserva({
        'POST /api/reservas': {
          status: 409,
          body: {
            error: {
              code: 'RESERVA_CONFLITO',
              message: 'A sala Sala Azul já está reservada das 10:00 às 11:00 em 01/12.',
              details: {
                conflitos: [
                  { inicio: '2026-12-01T13:00:00.000Z', fim: '2026-12-01T14:00:00.000Z' },
                ],
                sugestoes: {
                  horarios: [{ horaInicio: '11:00', horaFim: '12:00' }],
                  salas: [
                    {
                      id: SALA_VERDE.id,
                      nome: 'Sala Verde',
                      localizacao: '3º andar',
                      capacidade: 4,
                    },
                  ],
                },
              },
            },
          },
        },
      }),
    );
    await abrirNovaReserva();
    fireEvent.change(campo('Motivo da reunião'), { target: { value: 'Alinhamento' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar reserva/ }));

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('já está reservada das 10:00 às 11:00');

    fireEvent.click(within(alerta).getByRole('button', { name: '11:00 às 12:00' }));
    expect(campo('Início').value).toBe('11:00');
    expect(campo('Término').value).toBe('12:00');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());

    // De novo o conflito, agora escolhendo outra sala.
    fireEvent.click(screen.getByRole('button', { name: /Confirmar reserva/ }));
    const alerta2 = await screen.findByRole('alert');
    fireEvent.click(within(alerta2).getByRole('button', { name: /Sala Verde/ }));
    expect(campo('Sala').value).toBe(SALA_VERDE.id);
  });
});

describe('detalhes da reserva', () => {
  const r = reservaMock();

  it('o dono vê Editar e cancela com confirmação', async () => {
    const cancelada = reservaMock({
      status: 'CANCELADA',
      podeEditar: false,
      podeCancelar: false,
      canceladaEm: '2026-10-09T15:00:00.000Z',
    });
    const fetchMock = mockApi({
      ...logadoComo(COLABORADOR),
      [`GET /api/reservas/${r.id}`]: { body: { reserva: r } },
      [`POST /api/reservas/${r.id}/cancelar`]: { body: { reserva: cancelada } },
    });
    renderApp(`/reservas/${r.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Planejamento mensal' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /Editar/ }).getAttribute('href')).toBe(
      `/reservas/${r.id}/editar`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    // Nada é enviado antes da confirmação.
    expect(corpoEnviado(fetchMock, `POST /api/reservas/${r.id}/cancelar`)).toBeUndefined();
    expect(screen.getByLabelText('Motivo do cancelamento (opcional)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));

    expect(await screen.findByText(/Reserva cancelada/)).toBeTruthy();
    expect(corpoEnviado(fetchMock, `POST /api/reservas/${r.id}/cancelar`)).toEqual({});
  });

  it('o administrador vê o histórico da reserva', async () => {
    mockApi({
      ...logadoComo(ADMIN),
      [`GET /api/reservas/${r.id}`]: { body: { reserva: r } },
      [`GET /api/admin/auditoria?entidade=reserva&entidadeId=${r.id}&limite=20`]: {
        body: {
          registros: [
            {
              id: 1,
              acao: 'RESERVA_CRIADA',
              entidade: 'reserva',
              entidadeId: r.id,
              alvo: 'Sala Azul, 01/12/2026 10:00',
              ator: { id: COLABORADOR.id, nome: COLABORADOR.nome },
              antes: null,
              depois: { motivo: 'Planejamento mensal' },
              ip: null,
              criadoEm: '2026-10-09T12:00:00.000Z',
            },
          ],
          proximo: null,
        },
      },
    });
    renderApp(`/reservas/${r.id}`);
    const historico = await screen.findByRole('list', { name: 'Registros do histórico' });
    expect(historico.textContent).toContain('Reserva criada');
    expect(historico.textContent).toContain('Caio Colaborador');
  });

  it('o colaborador não vê (nem pede) o histórico', async () => {
    const fetchMock = mockApi({
      ...logadoComo(COLABORADOR),
      [`GET /api/reservas/${r.id}`]: { body: { reserva: r } },
    });
    renderApp(`/reservas/${r.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Planejamento mensal' });
    expect(screen.queryByText('Histórico desta reserva')).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/admin/auditoria'))).toBe(
      false,
    );
  });

  it('quem não pode alterar não vê os botões', async () => {
    mockApi({
      ...logadoComo(ADMIN),
      [`GET /api/reservas/${r.id}`]: {
        body: { reserva: reservaMock({ podeEditar: false, podeCancelar: false }) },
      },
    });
    renderApp(`/reservas/${r.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Planejamento mensal' });
    expect(screen.queryByRole('link', { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).toBeNull();
  });

  it('administrador cancelando reserva de outra pessoa precisa informar o motivo', async () => {
    const fetchMock = mockApi({
      ...logadoComo(ADMIN),
      [`GET /api/reservas/${r.id}`]: { body: { reserva: r } },
      [`POST /api/reservas/${r.id}/cancelar`]: {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Informe o motivo do cancelamento.',
            details: [{ campo: 'motivo', mensagem: 'Informe o motivo do cancelamento.' }],
          },
        },
      },
    });
    renderApp(`/reservas/${r.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Planejamento mensal' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    expect(screen.getByLabelText('Motivo do cancelamento (obrigatório)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(await screen.findByText('Informe o motivo do cancelamento.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Motivo do cancelamento (obrigatório)'), {
      target: { value: 'Sala necessária para a diretoria' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
    await waitFor(() =>
      expect(corpoEnviado(fetchMock, `POST /api/reservas/${r.id}/cancelar`)).toEqual({
        motivo: 'Sala necessária para a diretoria',
      }),
    );
  });
});

describe('editar reserva', () => {
  it('abre preenchida e envia a versão vista', async () => {
    const r = reservaMock({ versao: 3 });
    const fetchMock = mockApi({
      ...logadoComo(COLABORADOR),
      'GET /api/salas': { body: { salas: [SALA_AZUL, SALA_VERDE] } },
      [`GET /api/reservas/${r.id}`]: { body: { reserva: r } },
      [OCUPACAO]: { body: { reservas: [r] } },
      [`PATCH /api/reservas/${r.id}`]: { body: { reserva: { ...r, versao: 4 } } },
    });
    renderApp(`/reservas/${r.id}/editar`);
    await screen.findByRole('button', { name: /Salvar alterações/ });

    expect(campo('Início').value).toBe('10:00');
    expect(campo('Motivo da reunião').value).toBe('Planejamento mensal');
    // A própria reserva não aparece como "ocupado".
    expect(await screen.findByText('Sala livre o dia todo.')).toBeTruthy();

    fireEvent.change(campo('Término'), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }));
    await screen.findByText('Reserva atualizada.');
    expect(corpoEnviado(fetchMock, `PATCH /api/reservas/${r.id}`)).toMatchObject({
      horaInicio: '10:00',
      horaFim: '12:00',
      versao: 3,
    });
  });
});
