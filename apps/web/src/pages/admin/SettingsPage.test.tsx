import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ADMIN, CONFIG, corpoEnviado, logadoComo, mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';

const PATCH = 'PATCH /api/admin/configuracoes';

async function abrir() {
  renderApp('/admin/configuracoes');
  return screen.findByRole('button', { name: 'Salvar configurações' });
}

describe('configurações', () => {
  it('abre com os valores atuais', async () => {
    mockApi(logadoComo(ADMIN));
    await abrir();
    expect(
      (
        screen.getByLabelText(
          'Motivo da reunião visível para todos os colaboradores',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect((screen.getByLabelText('Início do expediente') as HTMLInputElement).value).toBe('07:00');
    expect((screen.getByLabelText('Antecedência máxima (dias)') as HTMLInputElement).value).toBe(
      '120',
    );
  });

  it('envia só o que mudou e confirma', async () => {
    const fetchMock = mockApi({
      ...logadoComo(ADMIN),
      [PATCH]: {
        body: {
          configuracoes: { ...CONFIG, motivoVisivelParaTodos: false, horarioFim: '18:00' },
        },
      },
    });
    const salvar = await abrir();
    fireEvent.click(screen.getByLabelText('Motivo da reunião visível para todos os colaboradores'));
    fireEvent.change(screen.getByLabelText('Fim do expediente'), { target: { value: '18:00' } });
    fireEvent.click(salvar);

    expect(await screen.findByText(/Configurações salvas/)).toBeTruthy();
    expect(corpoEnviado(fetchMock, PATCH)).toEqual({
      motivoVisivelParaTodos: false,
      horarioFim: '18:00',
    });
  });

  it('desativação por falta de uso: em branco desliga (envia null)', async () => {
    const fetchMock = mockApi({
      ...logadoComo(ADMIN),
      [PATCH]: { body: { configuracoes: { ...CONFIG, desativarAposDiasSemLogin: null } } },
    });
    const salvar = await abrir();
    const campo = screen.getByLabelText('Desativar contas sem login há (dias)') as HTMLInputElement;
    expect(campo.value).toBe('60');

    fireEvent.change(campo, { target: { value: '10' } });
    fireEvent.click(salvar);
    expect(await screen.findByText('O valor mínimo é 15.')).toBeTruthy();
    expect(corpoEnviado(fetchMock, PATCH)).toBeUndefined();

    fireEvent.change(campo, { target: { value: '' } });
    fireEvent.click(salvar);
    expect(await screen.findByText(/Configurações salvas/)).toBeTruthy();
    expect(corpoEnviado(fetchMock, PATCH)).toEqual({ desativarAposDiasSemLogin: null });
  });

  it('limite de reservas por pessoa: mostra o valor e envia só ele quando alterado', async () => {
    const fetchMock = mockApi({
      ...logadoComo(ADMIN),
      [PATCH]: { body: { configuracoes: { ...CONFIG, maxReservasFuturasPorPessoa: 10 } } },
    });
    const salvar = await abrir();
    const campo = screen.getByLabelText('Reservas futuras por pessoa') as HTMLInputElement;
    expect(campo.value).toBe('30');
    fireEvent.change(campo, { target: { value: '10' } });
    fireEvent.click(salvar);
    expect(await screen.findByText(/Configurações salvas/)).toBeTruthy();
    expect(corpoEnviado(fetchMock, PATCH)).toEqual({ maxReservasFuturasPorPessoa: 10 });
  });

  it('valida antes de enviar', async () => {
    const fetchMock = mockApi(logadoComo(ADMIN));
    const salvar = await abrir();

    fireEvent.change(screen.getByLabelText('Fim do expediente'), { target: { value: '06:00' } });
    fireEvent.change(screen.getByLabelText('Antecedência máxima (dias)'), {
      target: { value: '0' },
    });
    fireEvent.click(salvar);
    expect(await screen.findByText('O valor mínimo é 1.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Antecedência máxima (dias)'), {
      target: { value: '60' },
    });
    fireEvent.click(salvar);
    expect(await screen.findByText('O fim do expediente deve ser depois do início.')).toBeTruthy();
    expect(corpoEnviado(fetchMock, PATCH)).toBeUndefined();
  });

  it('sem alterações, avisa e não envia nada', async () => {
    const fetchMock = mockApi(logadoComo(ADMIN));
    fireEvent.click(await abrir());
    expect(await screen.findByText('Nada foi alterado.')).toBeTruthy();
    expect(corpoEnviado(fetchMock, PATCH)).toBeUndefined();
  });
});
