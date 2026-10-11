import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COLABORADOR, corpoEnviado, logadoComo, mockApi } from '../test/mock-api';
import { renderApp } from '../test/render';

function preencher(atual: string, nova: string, confirmacao: string) {
  fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: atual } });
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: nova } });
  fireEvent.change(screen.getByLabelText('Confirme a nova senha'), {
    target: { value: confirmacao },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));
}

describe('Minha conta', () => {
  it('mostra os dados de quem está logado', async () => {
    mockApi(logadoComo(COLABORADOR));
    renderApp('/minha-conta');
    expect(await screen.findByRole('heading', { level: 1, name: 'Minha conta' })).toBeTruthy();
    expect(screen.getAllByText('caio@empresa.com').length).toBeGreaterThan(0);
  });

  it('não envia se a confirmação não confere', async () => {
    const fetchMock = mockApi(logadoComo(COLABORADOR));
    renderApp('/minha-conta');
    await screen.findByRole('heading', { level: 1, name: 'Minha conta' });
    preencher('senha-atual-123', 'nova-senha-456', 'outra-coisa-789');

    expect(await screen.findByText('A confirmação não confere com a nova senha.')).toBeTruthy();
    expect(corpoEnviado(fetchMock, 'POST /api/auth/alterar-senha')).toBeUndefined();
  });

  it('troca a senha e confirma o sucesso', async () => {
    const fetchMock = mockApi({
      ...logadoComo(COLABORADOR),
      'POST /api/auth/alterar-senha': { status: 204 },
    });
    renderApp('/minha-conta');
    await screen.findByRole('heading', { level: 1, name: 'Minha conta' });
    preencher('senha-atual-123', 'nova-senha-456', 'nova-senha-456');

    expect(await screen.findByText('Senha alterada.')).toBeTruthy();
    expect(corpoEnviado(fetchMock, 'POST /api/auth/alterar-senha')).toEqual({
      senhaAtual: 'senha-atual-123',
      novaSenha: 'nova-senha-456',
    });
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('');
  });

  it('mostra no campo quando a senha atual está errada', async () => {
    mockApi({
      ...logadoComo(COLABORADOR),
      'POST /api/auth/alterar-senha': {
        status: 400,
        body: {
          error: {
            code: 'SENHA_ATUAL_INCORRETA',
            message: 'A senha atual não confere.',
            details: [{ campo: 'senhaAtual', mensagem: 'A senha atual não confere.' }],
          },
        },
      },
    });
    renderApp('/minha-conta');
    await screen.findByRole('heading', { level: 1, name: 'Minha conta' });
    preencher('errada-000000', 'nova-senha-456', 'nova-senha-456');

    expect(await screen.findByText('A senha atual não confere.')).toBeTruthy();
    expect(screen.getByLabelText('Senha atual').getAttribute('aria-invalid')).toBe('true');
  });
});
