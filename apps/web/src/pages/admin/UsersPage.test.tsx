import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ADMIN,
  COLABORADOR,
  corpoEnviado,
  logadoComo,
  mockApi,
  usuarioAdmin,
} from '../../test/mock-api';
import { renderApp } from '../../test/render';

const lista = [
  usuarioAdmin(ADMIN),
  usuarioAdmin(COLABORADOR, { bloqueado: true }),
  usuarioAdmin(
    {
      id: '6f1c2b1e-3333-4a7b-9c3d-000000000003',
      nome: 'Inês Inativa',
      email: 'ines@empresa.com',
      perfil: 'COLABORADOR',
    },
    { ativo: false, ultimoLoginEm: null },
  ),
];

function rotas(extra: Parameters<typeof mockApi>[0] = {}) {
  return {
    ...logadoComo(ADMIN),
    'GET /api/admin/usuarios': { body: { usuarios: lista } },
    ...extra,
  };
}

async function abrirPagina() {
  renderApp('/admin/usuarios');
  return screen.findByRole('list', { name: 'Lista de usuários' });
}

describe('Usuários (administrador)', () => {
  it('lista os usuários ativos, com perfil e alerta de bloqueio', async () => {
    mockApi(rotas());
    const listaEl = await abrirPagina();
    expect(within(listaEl).getByText('Ana Admin')).toBeTruthy();
    expect(within(listaEl).getByText('(você)')).toBeTruthy();
    expect(within(listaEl).getByText('Caio Colaborador')).toBeTruthy();
    expect(within(listaEl).getByText('Bloqueado por tentativas')).toBeTruthy();
    // Inativos ficam fora do filtro padrão.
    expect(within(listaEl).queryByText('Inês Inativa')).toBeNull();
  });

  it('filtra por situação e busca sem diferenciar acentos', async () => {
    mockApi(rotas());
    await abrirPagina();
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'todos' } });
    fireEvent.change(screen.getByLabelText('Buscar por nome ou e-mail'), {
      target: { value: 'ines' },
    });
    const listaEl = screen.getByRole('list', { name: 'Lista de usuários' });
    expect(within(listaEl).getByText('Inês Inativa')).toBeTruthy();
    expect(within(listaEl).queryByText('Ana Admin')).toBeNull();
  });

  it('Desbloquear aparece só para contas bloqueadas e chama a API', async () => {
    const fetchMock = mockApi(
      rotas({
        [`POST /api/admin/usuarios/${COLABORADOR.id}/desbloquear`]: {
          body: { usuario: usuarioAdmin(COLABORADOR, { bloqueado: false }) },
        },
      }),
    );
    const listaEl = await abrirPagina();
    const minhaLinha = within(listaEl).getByText('Ana Admin').closest('li')!;
    expect(within(minhaLinha).queryByRole('button', { name: 'Desbloquear' })).toBeNull();

    const linhaCaio = within(listaEl).getByText('Caio Colaborador').closest('li')!;
    fireEvent.click(within(linhaCaio).getByRole('button', { name: 'Desbloquear' }));
    expect(await screen.findByText(/Caio Colaborador foi desbloqueado/)).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === `/api/admin/usuarios/${COLABORADOR.id}/desbloquear` && init?.method === 'POST',
      ),
    ).toBe(true);
  });

  it('o próprio administrador não tem as opções de desativar nem redefinir senha', async () => {
    mockApi(rotas());
    const listaEl = await abrirPagina();
    const minhaLinha = within(listaEl).getByText('Ana Admin').closest('li')!;
    expect(within(minhaLinha).queryByRole('button', { name: 'Desativar' })).toBeNull();
    expect(within(minhaLinha).queryByRole('button', { name: 'Redefinir senha' })).toBeNull();
  });

  it('cadastra um usuário e mostra a confirmação', async () => {
    const novo = usuarioAdmin({
      id: '6f1c2b1e-4444-4a7b-9c3d-000000000004',
      nome: 'Davi Novo',
      email: 'davi@empresa.com',
      perfil: 'COLABORADOR',
    });
    const fetchMock = mockApi(
      rotas({ 'POST /api/admin/usuarios': { status: 201, body: { usuario: novo } } }),
    );
    await abrirPagina();

    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }));
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Davi Novo' } });
    fireEvent.change(screen.getByLabelText('E-mail corporativo'), {
      target: { value: 'Davi@Empresa.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha inicial'), {
      target: { value: 'senha-inicial-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar usuário' }));

    expect(await screen.findByText(/Davi Novo foi cadastrado/)).toBeTruthy();
    expect(corpoEnviado(fetchMock, 'POST /api/admin/usuarios')).toEqual({
      nome: 'Davi Novo',
      email: 'davi@empresa.com',
      perfil: 'COLABORADOR',
      senha: 'senha-inicial-123',
    });
  });

  it('valida a senha inicial antes de enviar', async () => {
    const fetchMock = mockApi(rotas());
    await abrirPagina();
    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }));
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Davi Novo' } });
    fireEvent.change(screen.getByLabelText('E-mail corporativo'), {
      target: { value: 'davi@empresa.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha inicial'), { target: { value: 'curta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar usuário' }));

    expect(await screen.findByText('A senha deve ter pelo menos 10 caracteres.')).toBeTruthy();
    expect(corpoEnviado(fetchMock, 'POST /api/admin/usuarios')).toBeUndefined();
  });

  it('mostra no campo o erro de e-mail repetido devolvido pela API', async () => {
    mockApi(
      rotas({
        'POST /api/admin/usuarios': {
          status: 409,
          body: {
            error: {
              code: 'EMAIL_EM_USO',
              message: 'Já existe um usuário com este e-mail.',
              details: [{ campo: 'email', mensagem: 'Já existe um usuário com este e-mail.' }],
            },
          },
        },
      }),
    );
    await abrirPagina();
    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }));
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Caio Dois' } });
    fireEvent.change(screen.getByLabelText('E-mail corporativo'), {
      target: { value: 'caio@empresa.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha inicial'), {
      target: { value: 'senha-inicial-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar usuário' }));

    expect(await screen.findAllByText('Já existe um usuário com este e-mail.')).not.toHaveLength(0);
    expect(screen.getByLabelText('E-mail corporativo').getAttribute('aria-invalid')).toBe('true');
  });

  it('desativar pede confirmação antes de chamar a API', async () => {
    const fetchMock = mockApi(
      rotas({
        [`PATCH /api/admin/usuarios/${COLABORADOR.id}`]: {
          body: { usuario: usuarioAdmin(COLABORADOR, { ativo: false }) },
        },
      }),
    );
    const listaEl = await abrirPagina();
    const linha = within(listaEl).getByText('Caio Colaborador').closest('li')!;

    fireEvent.click(within(linha).getByRole('button', { name: 'Desativar' }));
    expect(corpoEnviado(fetchMock, `PATCH /api/admin/usuarios/${COLABORADOR.id}`)).toBeUndefined();

    fireEvent.click(within(linha).getByRole('button', { name: 'Confirmar desativação' }));
    expect(await screen.findByText(/Caio Colaborador foi desativado/)).toBeTruthy();
    expect(corpoEnviado(fetchMock, `PATCH /api/admin/usuarios/${COLABORADOR.id}`)).toEqual({
      ativo: false,
    });
  });

  it('desativar quem tem reservas futuras pergunta o que fazer com elas', async () => {
    const chave = `PATCH /api/admin/usuarios/${COLABORADOR.id}`;
    const fetchMock = mockApi(
      rotas({
        [chave]: ({ body }) =>
          (body as { reservasFuturas?: string }).reservasFuturas
            ? {
                body: {
                  usuario: usuarioAdmin(COLABORADOR, { ativo: false }),
                  reservasCanceladas: 2,
                },
              }
            : {
                status: 409,
                body: {
                  error: {
                    code: 'USUARIO_COM_RESERVAS_FUTURAS',
                    message: 'Caio Colaborador tem 2 reserva(s) futura(s).',
                    details: {
                      total: 2,
                      reservas: [
                        {
                          id: 'ee000000-0000-4000-8000-000000000001',
                          inicio: '2026-12-01T13:00:00.000Z',
                          fim: '2026-12-01T14:00:00.000Z',
                          sala: 'Sala Azul',
                        },
                      ],
                    },
                  },
                },
              },
      }),
    );
    const listaEl = await abrirPagina();
    const linha = within(listaEl).getByText('Caio Colaborador').closest('li')!;
    fireEvent.click(within(linha).getByRole('button', { name: 'Desativar' }));
    fireEvent.click(within(linha).getByRole('button', { name: 'Confirmar desativação' }));

    expect(await screen.findByText('2 reserva(s) futura(s)')).toBeTruthy();
    expect(screen.getByText(/10:00 às 11:00: Sala Azul/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Desativar e cancelar as reservas' }));

    expect(
      await screen.findByText(/desativado\(a\) e 2 reserva\(s\) futura\(s\) foram canceladas/),
    ).toBeTruthy();
    expect(corpoEnviado(fetchMock, chave)).toEqual({ ativo: false, reservasFuturas: 'cancelar' });
  });

  it('editar envia apenas os campos alterados', async () => {
    const fetchMock = mockApi(
      rotas({
        [`PATCH /api/admin/usuarios/${COLABORADOR.id}`]: {
          body: { usuario: usuarioAdmin({ ...COLABORADOR, nome: 'Caio Silva' }) },
        },
      }),
    );
    const listaEl = await abrirPagina();
    const linha = within(listaEl).getByText('Caio Colaborador').closest('li')!;
    fireEvent.click(within(linha).getByRole('button', { name: 'Editar' }));

    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Caio Silva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Dados de Caio Silva atualizados.')).toBeTruthy();
    expect(corpoEnviado(fetchMock, `PATCH /api/admin/usuarios/${COLABORADOR.id}`)).toEqual({
      nome: 'Caio Silva',
    });
  });
});
