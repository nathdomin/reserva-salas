import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { destinoSeguro } from '../../components/auth/guards';
import {
  ADMIN,
  COLABORADOR,
  corpoEnviado,
  HEALTH_OK,
  logadoComo,
  mockApi,
  SEM_SESSAO,
} from '../../test/mock-api';
import { renderApp } from '../../test/render';

function preencherLogin(email: string, senha: string) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: senha } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('login e proteção de rotas', () => {
  it('sem sessão, qualquer página leva ao login e lembra o destino', async () => {
    mockApi({ 'GET /api/auth/me': SEM_SESSAO });
    const { location } = renderApp('/calendario');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(location.pathname).toBe('/login');
  });

  it('login correto entra e volta para a página pedida', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': SEM_SESSAO,
      'POST /api/auth/login': { body: { usuario: COLABORADOR } },
      'GET /api/health': HEALTH_OK,
    });
    const { location } = renderApp('/calendario');
    await screen.findByRole('heading', { name: 'Entrar' });

    preencherLogin('  Caio@Empresa.com ', 'minha-senha-123');

    expect(await screen.findByRole('heading', { level: 1, name: 'Calendário' })).toBeTruthy();
    expect(location.pathname).toBe('/calendario');
    // O e-mail vai normalizado para a API.
    expect(corpoEnviado(fetchMock, 'POST /api/auth/login')).toEqual({
      email: 'caio@empresa.com',
      senha: 'minha-senha-123',
    });
  });

  it('avisa depois do login se houve senhas erradas na conta, até a pessoa dispensar', async () => {
    mockApi({
      'GET /api/auth/me': SEM_SESSAO,
      'POST /api/auth/login': { body: { usuario: COLABORADOR, tentativasSemSucesso: 3 } },
      'GET /api/health': HEALTH_OK,
    });
    renderApp('/calendario');
    await screen.findByRole('heading', { name: 'Entrar' });
    preencherLogin('caio@empresa.com', 'minha-senha-123');

    expect(await screen.findByText(/Houve 3 tentativas de entrar na sua conta/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    await waitFor(() => expect(screen.queryByText(/Houve 3 tentativas/)).toBeNull());
  });

  it('sem senhas erradas desde o último acesso, não mostra aviso', async () => {
    mockApi({
      'GET /api/auth/me': SEM_SESSAO,
      'POST /api/auth/login': { body: { usuario: COLABORADOR, tentativasSemSucesso: 0 } },
      'GET /api/health': HEALTH_OK,
    });
    renderApp('/calendario');
    await screen.findByRole('heading', { name: 'Entrar' });
    preencherLogin('caio@empresa.com', 'minha-senha-123');
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendário' })).toBeTruthy();
    expect(screen.queryByText(/tentativa.* de entrar na sua conta/)).toBeNull();
  });

  it('credenciais erradas mostram a mensagem da API e limpam a senha', async () => {
    mockApi({
      'GET /api/auth/me': SEM_SESSAO,
      'POST /api/auth/login': {
        status: 401,
        body: { error: { code: 'CREDENCIAIS_INVALIDAS', message: 'E-mail ou senha incorretos.' } },
      },
    });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Entrar' });
    preencherLogin('caio@empresa.com', 'senha-errada');

    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeTruthy();
    expect((screen.getByLabelText('Senha') as HTMLInputElement).value).toBe('');
  });

  it('valida os campos antes de chamar a API', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': SEM_SESSAO });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Entrar' });
    preencherLogin('nao-e-email', '');

    expect(await screen.findByText('Informe um e-mail válido.')).toBeTruthy();
    expect(screen.getByText('Informe a senha.')).toBeTruthy();
    expect(corpoEnviado(fetchMock, 'POST /api/auth/login')).toBeUndefined();
  });

  it('quem já está logado e abre /login vai direto para o início', async () => {
    mockApi(logadoComo(ADMIN));
    const { location } = renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Olá, Ana' })).toBeTruthy();
    expect(location.pathname).toBe('/');
  });

  it('colaborador que digita a URL da área administrativa vê "Acesso restrito"', async () => {
    const fetchMock = mockApi(logadoComo(COLABORADOR));
    renderApp('/admin/usuarios');
    expect(await screen.findByText('Acesso restrito')).toBeTruthy();
    // Nem chega a pedir a lista de usuários à API.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/admin/'))).toBe(false);
  });

  it('Sair encerra a sessão na API e volta para o login', async () => {
    const fetchMock = mockApi({
      ...logadoComo(ADMIN),
      'POST /api/auth/logout': { status: 204 },
    });
    const { location } = renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Menu principal' });
    const aside = nav.closest('aside')!;
    fireEvent.click(within(aside).getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(location.pathname).toBe('/login');
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => url === '/api/auth/logout' && init?.method === 'POST',
      ),
    ).toBe(true);
  });

  it('sessão expirada no meio do uso leva de volta ao login', async () => {
    let sessaoValida = true;
    mockApi({
      'GET /api/auth/me': () => (sessaoValida ? { body: { usuario: ADMIN } } : SEM_SESSAO),
      'GET /api/health': HEALTH_OK,
      'GET /api/admin/usuarios': SEM_SESSAO,
    });
    const { location } = renderApp('/');
    await screen.findByRole('navigation', { name: 'Menu principal' });

    sessaoValida = false;
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Menu principal' })).getByRole('link', {
        name: 'Usuários',
      }),
    );
    await waitFor(() => expect(location.pathname).toBe('/login'));
  });
});

describe('destino seguro após o login', () => {
  it('aceita só caminhos internos', () => {
    expect(destinoSeguro('/calendario?sala=1')).toBe('/calendario?sala=1');
    expect(destinoSeguro(null)).toBe('/');
    expect(destinoSeguro('https://site-malicioso.example')).toBe('/');
    expect(destinoSeguro('//site-malicioso.example')).toBe('/');
    expect(destinoSeguro('/\\site-malicioso.example')).toBe('/');
    expect(destinoSeguro('/login')).toBe('/');
  });
});
