import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ADMIN, COLABORADOR, logadoComo, mockApi } from '../../test/mock-api';
import { renderApp } from '../../test/render';

async function menuPrincipal() {
  return screen.findByRole('navigation', { name: 'Menu principal' });
}

describe('layout da aplicação', () => {
  it('administrador vê o menu completo, com a seção Administração', async () => {
    mockApi(logadoComo(ADMIN));
    renderApp('/');
    const nav = await menuPrincipal();
    for (const label of [
      'Início',
      'Calendário',
      'Minhas reservas',
      'Reservas',
      'Salas',
      'Usuários',
      'Histórico de alterações',
      'Configurações',
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
    }
    expect(within(nav).getByRole('link', { name: 'Nova reserva' }).getAttribute('href')).toBe(
      '/reservas/nova',
    );
  });

  it('colaborador NÃO vê a seção Administração', async () => {
    mockApi(logadoComo(COLABORADOR));
    renderApp('/');
    const nav = await menuPrincipal();
    expect(within(nav).getByRole('link', { name: 'Calendário' })).toBeTruthy();
    expect(within(nav).queryByText('Administração')).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Usuários' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Configurações' })).toBeNull();
  });

  it('mostra quem está logado', async () => {
    mockApi(logadoComo(COLABORADOR));
    renderApp('/');
    await menuPrincipal();
    expect(screen.getAllByText('Caio Colaborador').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Minha conta' })).toBeTruthy();
  });

  it('marca a página atual no menu', async () => {
    mockApi(logadoComo(ADMIN));
    renderApp('/calendario');
    const nav = await menuPrincipal();
    expect(within(nav).getByRole('link', { name: 'Calendário' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Início' }).hasAttribute('aria-current')).toBe(
      false,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Calendário' })).toBeTruthy();
  });

  it('navega ao clicar em Nova reserva', async () => {
    mockApi(logadoComo(ADMIN));
    const { location } = renderApp('/');
    const nav = await menuPrincipal();
    fireEvent.click(within(nav).getByRole('link', { name: 'Nova reserva' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Nova reserva' })).toBeTruthy();
    expect(location.pathname).toBe('/reservas/nova');
  });

  it('abre e fecha o menu do celular (botão e tecla Esc)', async () => {
    mockApi(logadoComo(ADMIN));
    renderApp('/');
    await menuPrincipal();
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
  });

  it('mostra página de não encontrado para endereço inexistente', async () => {
    mockApi(logadoComo(ADMIN));
    renderApp('/endereco-que-nao-existe');
    expect(await screen.findByText('Página não encontrada')).toBeTruthy();
  });
});
