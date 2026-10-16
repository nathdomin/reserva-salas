import {
  hojeNoFuso,
  type Configuracoes,
  type Reserva,
  type Sala,
  type UsuarioAdmin,
  type UsuarioSessao,
} from '@reserva/shared';
import { vi } from 'vitest';

export interface MockResposta {
  status?: number;
  body?: unknown;
}

type Rota = MockResposta | ((req: { url: string; body: unknown }) => MockResposta);

/**
 * Substitui o fetch: cada chave é "MÉTODO /api/caminho".
 * Cada chamada recebe uma Response nova (o corpo de uma Response só pode ser lido uma vez).
 */
export function mockApi(rotas: Record<string, Rota>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init.method ?? 'GET').toUpperCase();
    const chave = `${method} ${url}`;
    const rota = rotas[chave];
    if (!rota) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: `Sem mock para ${chave}` } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const resposta = typeof rota === 'function' ? rota({ url, body }) : rota;
    const status = resposta.status ?? 200;
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(resposta.body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Corpo enviado na chamada "MÉTODO /api/caminho" (a última, se houver várias). */
export function corpoEnviado(fetchMock: ReturnType<typeof mockApi>, chave: string): unknown {
  const [method, url] = chave.split(' ');
  const chamadas = fetchMock.mock.calls.filter(
    ([input, init]) => String(input) === url && (init?.method ?? 'GET').toUpperCase() === method,
  );
  const init = chamadas.at(-1)?.[1];
  return typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
}

export const ADMIN: UsuarioSessao = {
  id: '6f1c2b1e-1111-4a7b-9c3d-000000000001',
  nome: 'Ana Admin',
  email: 'ana@empresa.com',
  perfil: 'ADMIN',
  trocarSenha: false,
};

export const COLABORADOR: UsuarioSessao = {
  id: '6f1c2b1e-2222-4a7b-9c3d-000000000002',
  nome: 'Caio Colaborador',
  email: 'caio@empresa.com',
  perfil: 'COLABORADOR',
  trocarSenha: false,
};

export function usuarioAdmin(
  base: Omit<UsuarioSessao, 'trocarSenha'> & { trocarSenha?: boolean },
  extra: Partial<UsuarioAdmin> = {},
): UsuarioAdmin {
  return {
    trocarSenha: false,
    ...base,
    ativo: true,
    bloqueado: false,
    sessoesAbertas: 0,
    ultimoLoginEm: '2026-10-09T12:00:00.000Z',
    criadoEm: '2026-10-01T12:00:00.000Z',
    ...extra,
  };
}

export const HEALTH_OK = {
  body: { status: 'ok', database: 'ok', timestamp: '2026-10-09T12:30:00.000Z' },
};

export const SEM_SESSAO = {
  status: 401,
  body: { error: { code: 'NAO_AUTENTICADO', message: 'Faça login para continuar.' } },
};

/** Rotas básicas de uma pessoa logada (sessão, situação do sistema e tela inicial). */
export function logadoComo(usuario: UsuarioSessao): Record<string, Rota> {
  const hoje = hojeNoFuso();
  return {
    'GET /api/auth/me': { body: { usuario } },
    'GET /api/health': HEALTH_OK,
    'GET /api/reservas/minhas?tipo=proximas&limite=6': { body: { reservas: [] } },
    // Barra lateral: contador de "Minhas reservas".
    'GET /api/reservas/minhas?tipo=proximas&limite=10': { body: { reservas: [] } },
    'GET /api/configuracoes': { body: { configuracoes: CONFIG } },
    // Tela inicial: salas e reservas de hoje ("Livres agora" e números do dia).
    'GET /api/salas': { body: { salas: [] } },
    [`GET /api/reservas?dataInicio=${hoje}&dataFim=${hoje}`]: { body: { reservas: [] } },
  };
}

export const CONFIG: Configuracoes = {
  motivoVisivelParaTodos: true,
  horarioInicio: '07:00',
  horarioFim: '20:00',
  granularidadeMinutos: 15,
  duracaoMinimaMinutos: 15,
  duracaoMaximaMinutos: 480,
  antecedenciaMaximaDias: 120,
  intervaloEntreReunioesMinutos: 0,
  desativarAposDiasSemLogin: 60,
};

export const SALA_AZUL: Sala = {
  id: '5a1a0000-0000-4000-8000-00000000000a',
  nome: 'Sala Azul',
  localizacao: '2º andar',
  capacidade: 8,
  recursos: ['Televisão'],
  descricao: null,
  ativo: true,
};

export const SALA_VERDE: Sala = {
  id: '5a1a0000-0000-4000-8000-00000000000b',
  nome: 'Sala Verde',
  localizacao: '3º andar',
  capacidade: 4,
  recursos: [],
  descricao: null,
  ativo: true,
};

export function reservaMock(extra: Partial<Reserva> = {}): Reserva {
  return {
    id: 'ee000000-0000-4000-8000-000000000001',
    sala: { id: SALA_AZUL.id, nome: SALA_AZUL.nome, localizacao: SALA_AZUL.localizacao },
    responsavel: { id: COLABORADOR.id, nome: COLABORADOR.nome },
    motivo: 'Planejamento mensal',
    motivoOculto: false,
    participantes: 5,
    // 01/12/2026, 10:00 às 11:00 em Brasília
    inicio: '2026-12-01T13:00:00.000Z',
    fim: '2026-12-01T14:00:00.000Z',
    diaInteiro: false,
    status: 'ATIVA',
    canceladaEm: null,
    motivoCancelamento: null,
    versao: 1,
    podeEditar: true,
    podeCancelar: true,
    criadoEm: '2026-10-09T12:00:00.000Z',
    atualizadoEm: '2026-10-09T12:00:00.000Z',
    ...extra,
  };
}
