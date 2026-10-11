import type { RegistroAuditoria } from '@reserva/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ADMIN, COLABORADOR, logadoComo, mockApi, usuarioAdmin } from '../../test/mock-api';
import { renderApp } from '../../test/render';

const RESERVA_ID = 'ee000000-0000-4000-8000-000000000001';

const ALTERADA: RegistroAuditoria = {
  id: 12,
  acao: 'RESERVA_ALTERADA',
  entidade: 'reserva',
  entidadeId: RESERVA_ID,
  alvo: 'Sala Azul, 01/12/2026 10:00',
  ator: { id: COLABORADOR.id, nome: COLABORADOR.nome },
  antes: { fim: '2026-12-01T14:00:00.000Z', participantes: null },
  depois: { fim: '2026-12-01T15:00:00.000Z', participantes: 6 },
  ip: '10.0.0.5',
  criadoEm: '2026-10-09T13:00:00.000Z',
};

const LOGIN_FALHO: RegistroAuditoria = {
  id: 11,
  acao: 'LOGIN_FALHO',
  entidade: 'usuario',
  entidadeId: ADMIN.id,
  alvo: 'Ana Admin',
  ator: null,
  antes: null,
  depois: null,
  ip: '10.0.0.9',
  criadoEm: '2026-10-09T12:00:00.000Z',
};

const SALA_CRIADA: RegistroAuditoria = {
  id: 3,
  acao: 'SALA_CRIADA',
  entidade: 'sala',
  entidadeId: '5a1a0000-0000-4000-8000-00000000000a',
  alvo: 'Sala Azul',
  ator: { id: ADMIN.id, nome: ADMIN.nome },
  antes: null,
  depois: { id: 'x', nome: 'Sala Azul', capacidade: 8, recursos: ['Televisão', 'Projetor'] },
  ip: null,
  criadoEm: '2026-10-01T12:00:00.000Z',
};

function rotas(extra: Parameters<typeof mockApi>[0] = {}) {
  return {
    ...logadoComo(ADMIN),
    'GET /api/admin/usuarios': {
      body: { usuarios: [usuarioAdmin(ADMIN), usuarioAdmin(COLABORADOR)] },
    },
    'GET /api/admin/auditoria?limite=50': {
      body: { registros: [ALTERADA, LOGIN_FALHO], proximo: 11 },
    },
    'GET /api/admin/auditoria?limite=50&antesDe=11': {
      body: { registros: [SALA_CRIADA], proximo: null },
    },
    ...extra,
  };
}

describe('histórico de alterações', () => {
  it('mostra quem fez, o que foi afetado e o que mudou', async () => {
    mockApi(rotas());
    renderApp('/admin/auditoria');
    const lista = await screen.findByRole('list', { name: 'Registros do histórico' });
    const [alterada, login] = within(lista).getAllByRole('listitem');

    expect(alterada!.textContent).toContain('Reserva alterada');
    expect(alterada!.textContent).toContain('09/10/2026, 10:00 · Caio Colaborador · IP 10.0.0.5');
    expect(
      within(alterada!)
        .getByRole('link', { name: 'Sala Azul, 01/12/2026 10:00' })
        .getAttribute('href'),
    ).toBe(`/reservas/${RESERVA_ID}`);
    // Antes e depois, com datas e nomes de campos legíveis.
    const linhas = within(alterada!)
      .getAllByRole('row')
      .map((r) => r.textContent);
    expect(linhas).toContain('Término01/12/2026, 11:0001/12/2026, 12:00');
    expect(linhas).toContain('Participantes—6');

    expect(login!.textContent).toContain('Login sem sucesso');
    expect(login!.textContent).toContain('Tentativa de login');
  });

  it('"Carregar mais" traz os registros mais antigos', async () => {
    mockApi(rotas());
    renderApp('/admin/auditoria');
    await screen.findByRole('list', { name: 'Registros do histórico' });

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    const lista = screen.getByRole('list', { name: 'Registros do histórico' });
    expect(await within(lista).findByText('Sala criada')).toBeTruthy();
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3);
    expect(within(lista).getByText('Televisão, Projetor')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('filtra por tipo e oferece só as ações daquele tipo', async () => {
    mockApi(
      rotas({
        'GET /api/admin/auditoria?entidade=reserva&limite=50': {
          body: { registros: [ALTERADA], proximo: null },
        },
      }),
    );
    renderApp('/admin/auditoria');
    await screen.findByRole('list', { name: 'Registros do histórico' });

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'reserva' } });
    const lista = await screen.findByRole('list', { name: 'Registros do histórico' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(1);
    expect(lista.textContent).toContain('Reserva alterada');
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeTruthy();
    const acoes = within(screen.getByLabelText('Ação'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(acoes).toEqual([
      'Todas as ações',
      'Reserva criada',
      'Reserva alterada',
      'Reserva cancelada',
    ]);
  });

  it('colaborador não acessa a tela', async () => {
    const fetchMock = mockApi(logadoComo(COLABORADOR));
    renderApp('/admin/auditoria');
    expect(await screen.findByText('Acesso restrito')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/admin/auditoria'))).toBe(
      false,
    );
  });
});
