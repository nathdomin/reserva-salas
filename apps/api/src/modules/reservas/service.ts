import {
  type Configuracoes,
  type ConflitoDetalhes,
  type EditarReservaInput,
  ERROR_CODES,
  MOTIVO_OCULTO,
  paraInstante,
  partesNoFuso,
  type Reserva,
  type ReservaInput,
  type Sala,
  somarDias,
  type StatusReserva,
  type UsuarioSessao,
} from '@reserva/shared';
import { isPgError, PG_ERROR, type Database, type Queryable } from '../../db/client';
import { AppError } from '../../plugins/errors';
import { registrarAuditoria } from '../audit/service';
import { buscarSala } from '../salas/service';
import { sugerirHorarios, validarPeriodo, type Periodo } from './regras';
import {
  ATUALIZAR_RESERVA,
  BUSCAR_CONFIGURACOES,
  BUSCAR_RESERVA,
  BUSCAR_RESERVA_PARA_ALTERAR,
  CANCELAR_RESERVA,
  CONFLITOS,
  CRIAR_RESERVA,
  LISTAR_RESERVAS_PERIODO,
  MINHAS_ANTERIORES,
  MINHAS_PROXIMAS,
  OCUPADOS_NO_PERIODO,
  SALAS_LIVRES,
  TRAVAR_SALA,
  TRAVAR_USUARIO,
} from './sql';

type ConfigRow = {
  motivo_visivel_para_todos: boolean;
  horario_inicio: string;
  horario_fim: string;
  granularidade_minutos: number;
  duracao_minima_minutos: number;
  duracao_maxima_minutos: number;
  antecedencia_maxima_dias: number;
  intervalo_entre_reunioes_minutos: number;
  desativar_apos_dias_sem_login: number | null;
};

type ReservaRow = {
  id: string;
  sala_id: string;
  sala_nome: string;
  sala_localizacao: string;
  usuario_id: string;
  usuario_nome: string;
  motivo: string;
  participantes: number | null;
  inicio: Date;
  fim: Date;
  dia_inteiro: boolean;
  status: StatusReserva;
  cancelada_em: Date | null;
  motivo_cancelamento: string | null;
  versao: number;
  criado_em: Date;
  atualizado_em: Date;
};

export async function carregarConfiguracoes(db: Queryable): Promise<Configuracoes> {
  const { rows } = await db.query<ConfigRow>(BUSCAR_CONFIGURACOES);
  const c = rows[0];
  if (!c) throw new Error('Configurações não encontradas. Rode npm run db:migrate.');
  return {
    motivoVisivelParaTodos: c.motivo_visivel_para_todos,
    horarioInicio: c.horario_inicio,
    horarioFim: c.horario_fim,
    granularidadeMinutos: c.granularidade_minutos,
    duracaoMinimaMinutos: c.duracao_minima_minutos,
    duracaoMaximaMinutos: c.duracao_maxima_minutos,
    antecedenciaMaximaDias: c.antecedencia_maxima_dias,
    intervaloEntreReunioesMinutos: c.intervalo_entre_reunioes_minutos,
    desativarAposDiasSemLogin: c.desativar_apos_dias_sem_login,
  };
}

/** Regras de quem pode alterar/cancelar (usadas na API e devolvidas para a interface). */
function motivoBloqueio(viewer: UsuarioSessao, row: ReservaRow, agora: Date): AppError | null {
  const admin = viewer.perfil === 'ADMIN';
  if (!admin && row.usuario_id !== viewer.id) {
    return new AppError(
      403,
      ERROR_CODES.SEM_PERMISSAO,
      'Você só pode alterar ou cancelar as suas próprias reservas.',
    );
  }
  if (row.status !== 'ATIVA') {
    return new AppError(409, ERROR_CODES.RESERVA_NAO_EDITAVEL, 'Esta reserva já foi cancelada.');
  }
  if (row.fim <= agora) {
    return new AppError(
      409,
      ERROR_CODES.RESERVA_NAO_EDITAVEL,
      'Esta reunião já terminou e não pode mais ser alterada.',
    );
  }
  if (!admin && row.inicio <= agora) {
    return new AppError(
      409,
      ERROR_CODES.RESERVA_NAO_EDITAVEL,
      'A reunião já começou. Se precisar alterá-la, fale com o administrador.',
    );
  }
  return null;
}

/** Monta a resposta conforme quem consulta (o motivo pode ficar oculto). */
export function serializarReserva(
  row: ReservaRow,
  viewer: UsuarioSessao,
  config: Configuracoes,
  agora: Date,
): Reserva {
  const dono = row.usuario_id === viewer.id;
  const verMotivo = config.motivoVisivelParaTodos || dono || viewer.perfil === 'ADMIN';
  const podeAlterar = motivoBloqueio(viewer, row, agora) === null;
  return {
    id: row.id,
    sala: { id: row.sala_id, nome: row.sala_nome, localizacao: row.sala_localizacao },
    responsavel: { id: row.usuario_id, nome: row.usuario_nome },
    motivo: verMotivo ? row.motivo : MOTIVO_OCULTO,
    motivoOculto: !verMotivo,
    participantes: row.participantes,
    inicio: row.inicio.toISOString(),
    fim: row.fim.toISOString(),
    diaInteiro: row.dia_inteiro,
    status: row.status,
    canceladaEm: row.cancelada_em ? row.cancelada_em.toISOString() : null,
    // Motivo do cancelamento: só para o responsável e a administração.
    motivoCancelamento: dono || viewer.perfil === 'ADMIN' ? row.motivo_cancelamento : null,
    versao: row.versao,
    podeEditar: podeAlterar,
    podeCancelar: podeAlterar,
    criadoEm: row.criado_em.toISOString(),
    atualizadoEm: row.atualizado_em.toISOString(),
  };
}

const reservaNaoEncontrada = () =>
  new AppError(404, ERROR_CODES.RESERVA_NAO_ENCONTRADA, 'Reserva não encontrada.');

const salaInativa = (sala: Sala) =>
  new AppError(
    422,
    ERROR_CODES.SALA_INATIVA,
    `A sala ${sala.nome} está desativada e não recebe novas reservas.`,
    [{ campo: 'salaId', mensagem: 'Esta sala está desativada.' }],
  );

function verificarCapacidade(sala: Sala, participantes: number | null) {
  if (participantes !== null && participantes > sala.capacidade) {
    const mensagem = `A sala ${sala.nome} comporta até ${sala.capacidade} pessoa(s).`;
    throw new AppError(422, ERROR_CODES.CAPACIDADE_EXCEDIDA, mensagem, [
      { campo: 'participantes', mensagem },
    ]);
  }
}

function validarOuFalhar(
  input: Pick<ReservaInput, 'data' | 'diaInteiro' | 'horaInicio' | 'horaFim'>,
  config: Configuracoes,
  agora: Date,
): Periodo {
  const resultado = validarPeriodo(input, config, agora, { verificarPassado: true });
  if (!resultado.ok) {
    throw new AppError(
      400,
      ERROR_CODES.HORARIO_INVALIDO,
      resultado.erros[0]?.mensagem ?? 'Horário inválido.',
      resultado.erros,
    );
  }
  return resultado;
}

const hora = (instante: Date) => partesNoFuso(instante).hora;

function dataCurta(instante: Date) {
  const [, m, d] = partesNoFuso(instante).data.split('-');
  return `${d}/${m}`;
}

function conflitoSimples(): AppError {
  return new AppError(
    409,
    ERROR_CODES.RESERVA_CONFLITO,
    'Outra pessoa acabou de reservar este horário. Escolha outro horário ou outra sala.',
    { conflitos: [], sugestoes: { horarios: [], salas: [] } } satisfies ConflitoDetalhes,
  );
}

export function createReservasService(database: Database, opcoes: { agora?: () => Date } = {}) {
  const db = database.pool;
  const agora = opcoes.agora ?? (() => new Date());

  async function buscarRow(q: Queryable, id: string, paraAlterar = false) {
    const { rows } = await q.query<ReservaRow>(
      paraAlterar ? BUSCAR_RESERVA_PARA_ALTERAR : BUSCAR_RESERVA,
      [id],
    );
    if (!rows[0]) throw reservaNaoEncontrada();
    return rows[0];
  }

  /** Erro 409 com os horários livres da sala no dia e outras salas livres no horário. */
  async function erroDeConflito(
    q: Queryable,
    p: {
      sala: Sala;
      periodo: Periodo;
      data: string;
      participantes: number | null;
      ignorarId: string | null;
      config: Configuracoes;
      conflitos: { inicio: Date; fim: Date }[];
    },
  ): Promise<AppError> {
    const { sala, periodo, data, config } = p;
    const intervalo = config.intervaloEntreReunioesMinutos;
    // Em sequência: um cliente dentro de transação não deve receber consultas simultâneas.
    const ocupados = await q.query<{ inicio: Date; fim: Date }>(OCUPADOS_NO_PERIODO, [
      sala.id,
      paraInstante(data, '00:00'),
      paraInstante(somarDias(data, 1), '00:00'),
      p.ignorarId,
    ]);
    const livres = await q.query<{
      id: string;
      nome: string;
      localizacao: string;
      capacidade: number;
    }>(SALAS_LIVRES, [sala.id, periodo.inicio, periodo.fim, p.participantes, intervalo]);
    const duracaoMinutos = Math.round((periodo.fim.getTime() - periodo.inicio.getTime()) / 60_000);
    const detalhes: ConflitoDetalhes = {
      conflitos: p.conflitos.map((c) => ({
        inicio: c.inicio.toISOString(),
        fim: c.fim.toISOString(),
      })),
      sugestoes: {
        horarios: sugerirHorarios({
          data,
          horaDesejada: periodo.horaInicio,
          duracaoMinutos,
          ocupados: ocupados.rows,
          config,
          agora: agora(),
        }),
        salas: livres.rows,
      },
    };
    const primeiro = p.conflitos[0]!;
    return new AppError(
      409,
      ERROR_CODES.RESERVA_CONFLITO,
      `A sala ${sala.nome} já está reservada das ${hora(primeiro.inicio)} às ${hora(primeiro.fim)} em ${dataCurta(primeiro.inicio)}.` +
        (intervalo > 0 ? ` (é preciso um intervalo de ${intervalo} min entre reuniões)` : ''),
      detalhes,
    );
  }

  /** Trava a sala e verifica conflitos. Deve rodar dentro de uma transação. */
  async function garantirSemConflito(
    tx: Queryable,
    p: {
      sala: Sala;
      periodo: Periodo;
      data: string;
      participantes: number | null;
      ignorarId: string | null;
      config: Configuracoes;
    },
  ) {
    await tx.query(TRAVAR_SALA, [p.sala.id]);
    const { rows } = await tx.query<{ id: string; inicio: Date; fim: Date }>(CONFLITOS, [
      p.sala.id,
      p.periodo.inicio,
      p.periodo.fim,
      p.ignorarId,
      p.config.intervaloEntreReunioesMinutos,
    ]);
    if (rows.length > 0) throw await erroDeConflito(tx, { ...p, conflitos: rows });
  }

  async function comConflitoDoBanco<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // Rede de segurança: se algo passar pela verificação, a restrição do banco barra.
      if (isPgError(error, PG_ERROR.EXCLUSION_VIOLATION, 'reservas_sem_conflito')) {
        throw conflitoSimples();
      }
      throw error;
    }
  }

  return {
    configuracoes: () => carregarConfiguracoes(db),

    async listarPeriodo(
      viewer: UsuarioSessao,
      filtros: {
        dataInicio: string;
        dataFim: string;
        salaId?: string | undefined;
        usuarioId?: string | undefined;
        incluirCanceladas: boolean;
      },
    ): Promise<Reserva[]> {
      // Colaborador: filtrar por responsável ou ver canceladas só das próprias reservas
      // (evita montar o histórico de reuniões de um colega).
      if (viewer.perfil !== 'ADMIN') {
        const deOutraPessoa = filtros.usuarioId !== undefined && filtros.usuarioId !== viewer.id;
        const canceladasAlheias = filtros.incluirCanceladas && filtros.usuarioId !== viewer.id;
        if (deOutraPessoa || canceladasAlheias) {
          throw new AppError(
            403,
            ERROR_CODES.SEM_PERMISSAO,
            'Você pode filtrar por responsável e ver reservas canceladas apenas das suas reservas.',
          );
        }
      }
      const config = await carregarConfiguracoes(db);
      const { rows } = await db.query<ReservaRow>(LISTAR_RESERVAS_PERIODO, [
        paraInstante(filtros.dataInicio, '00:00'),
        paraInstante(somarDias(filtros.dataFim, 1), '00:00'),
        filtros.salaId ?? null,
        filtros.usuarioId ?? null,
        filtros.incluirCanceladas,
      ]);
      const agoraAtual = agora();
      return rows.map((row) => serializarReserva(row, viewer, config, agoraAtual));
    },

    async minhas(
      viewer: UsuarioSessao,
      tipo: 'proximas' | 'anteriores',
      limite: number,
    ): Promise<Reserva[]> {
      const config = await carregarConfiguracoes(db);
      const { rows } = await db.query<ReservaRow>(
        tipo === 'proximas' ? MINHAS_PROXIMAS : MINHAS_ANTERIORES,
        [viewer.id, limite],
      );
      const agoraAtual = agora();
      return rows.map((row) => serializarReserva(row, viewer, config, agoraAtual));
    },

    async buscar(viewer: UsuarioSessao, id: string): Promise<Reserva> {
      const config = await carregarConfiguracoes(db);
      return serializarReserva(await buscarRow(db, id), viewer, config, agora());
    },

    async criar(viewer: UsuarioSessao, ip: string, input: ReservaInput): Promise<Reserva> {
      const config = await carregarConfiguracoes(db);
      const agoraAtual = agora();
      return comConflitoDoBanco(() =>
        database.transaction(async (tx) => {
          // Travas de linha: uma desativação simultânea da pessoa ou da sala espera esta
          // reserva terminar (e a enxerga), em vez de deixar uma reserva "órfã".
          const { rows: pessoa } = await tx.query<{ ativo: boolean }>(TRAVAR_USUARIO, [viewer.id]);
          if (!pessoa[0]?.ativo) {
            throw new AppError(401, ERROR_CODES.NAO_AUTENTICADO, 'Seu acesso foi encerrado.');
          }
          const sala = await buscarSala(tx, input.salaId, true);
          if (!sala.ativo) throw salaInativa(sala);
          verificarCapacidade(sala, input.participantes);
          const periodo = validarOuFalhar(input, config, agoraAtual);

          await garantirSemConflito(tx, {
            sala,
            periodo,
            data: input.data,
            participantes: input.participantes,
            ignorarId: null,
            config,
          });

          const { rows } = await tx.query<{ id: string }>(CRIAR_RESERVA, [
            sala.id,
            viewer.id,
            input.motivo,
            input.participantes,
            periodo.inicio,
            periodo.fim,
            input.diaInteiro,
          ]);
          const id = rows[0]!.id;
          await registrarAuditoria(tx, {
            atorId: viewer.id,
            acao: 'RESERVA_CRIADA',
            entidade: 'reserva',
            entidadeId: id,
            depois: {
              sala: sala.nome,
              inicio: periodo.inicio.toISOString(),
              fim: periodo.fim.toISOString(),
              diaInteiro: input.diaInteiro,
              motivo: input.motivo,
              participantes: input.participantes,
            },
            ip,
          });
          return serializarReserva(await buscarRow(tx, id), viewer, config, agoraAtual);
        }),
      );
    },

    async editar(
      viewer: UsuarioSessao,
      ip: string,
      id: string,
      input: EditarReservaInput,
    ): Promise<Reserva> {
      const config = await carregarConfiguracoes(db);
      const agoraAtual = agora();
      return comConflitoDoBanco(() =>
        database.transaction(async (tx) => {
          const atual = await buscarRow(tx, id, true);
          const bloqueio = motivoBloqueio(viewer, atual, agoraAtual);
          if (bloqueio) throw bloqueio;
          if (atual.versao !== input.versao) {
            throw new AppError(
              409,
              ERROR_CODES.RESERVA_ALTERADA,
              'Esta reserva foi alterada por outra pessoa enquanto você editava. Recarregue para ver a versão atual.',
            );
          }

          const sala = await buscarSala(tx, input.salaId, true);
          const mudouSala = sala.id !== atual.sala_id;

          // Se o horário não mudou, não revalida (a reunião pode já ter começado, no caso do admin).
          const semPassado = validarPeriodo(input, config, agoraAtual, { verificarPassado: false });
          const mesmoHorario =
            semPassado.ok &&
            semPassado.inicio.getTime() === atual.inicio.getTime() &&
            semPassado.fim.getTime() === atual.fim.getTime() &&
            input.diaInteiro === atual.dia_inteiro;

          if ((mudouSala || !mesmoHorario) && !sala.ativo) throw salaInativa(sala);
          if (mudouSala || input.participantes !== atual.participantes) {
            verificarCapacidade(sala, input.participantes);
          }

          const periodo: Periodo = mesmoHorario
            ? {
                inicio: atual.inicio,
                fim: atual.fim,
                horaInicio: hora(atual.inicio),
                horaFim: hora(atual.fim),
              }
            : validarOuFalhar(input, config, agoraAtual);

          if (mudouSala || !mesmoHorario) {
            await garantirSemConflito(tx, {
              sala,
              periodo,
              data: input.data,
              participantes: input.participantes,
              ignorarId: id,
              config,
            });
          }

          const { rows } = await tx.query<{ id: string }>(ATUALIZAR_RESERVA, [
            id,
            sala.id,
            input.motivo,
            input.participantes,
            periodo.inicio,
            periodo.fim,
            input.diaInteiro,
            input.versao,
          ]);
          if (!rows[0]) {
            throw new AppError(
              409,
              ERROR_CODES.RESERVA_ALTERADA,
              'Esta reserva foi alterada por outra pessoa. Recarregue para ver a versão atual.',
            );
          }

          const antes: Record<string, unknown> = {};
          const depois: Record<string, unknown> = {};
          const comparar = (campo: string, a: unknown, b: unknown) => {
            if (a !== b) {
              antes[campo] = a;
              depois[campo] = b;
            }
          };
          comparar('sala', atual.sala_nome, sala.nome);
          comparar('inicio', atual.inicio.toISOString(), periodo.inicio.toISOString());
          comparar('fim', atual.fim.toISOString(), periodo.fim.toISOString());
          comparar('diaInteiro', atual.dia_inteiro, input.diaInteiro);
          comparar('motivo', atual.motivo, input.motivo);
          comparar('participantes', atual.participantes, input.participantes);
          if (Object.keys(depois).length > 0) {
            await registrarAuditoria(tx, {
              atorId: viewer.id,
              acao: 'RESERVA_ALTERADA',
              entidade: 'reserva',
              entidadeId: id,
              antes,
              depois,
              ip,
            });
          }
          return serializarReserva(await buscarRow(tx, id), viewer, config, agoraAtual);
        }),
      );
    },

    async cancelar(
      viewer: UsuarioSessao,
      ip: string,
      id: string,
      motivo: string | undefined,
    ): Promise<Reserva> {
      const config = await carregarConfiguracoes(db);
      const agoraAtual = agora();
      return database.transaction(async (tx) => {
        const atual = await buscarRow(tx, id, true);
        const bloqueio = motivoBloqueio(viewer, atual, agoraAtual);
        if (bloqueio) throw bloqueio;
        if (atual.usuario_id !== viewer.id && !motivo) {
          const mensagem =
            'Informe o motivo do cancelamento: o responsável será informado por ele.';
          throw new AppError(400, ERROR_CODES.VALIDATION, mensagem, [
            { campo: 'motivo', mensagem },
          ]);
        }
        await tx.query(CANCELAR_RESERVA, [id, viewer.id, motivo ?? null]);
        await registrarAuditoria(tx, {
          atorId: viewer.id,
          acao: 'RESERVA_CANCELADA',
          entidade: 'reserva',
          entidadeId: id,
          antes: { status: 'ATIVA' },
          depois: { status: 'CANCELADA', motivoCancelamento: motivo ?? null },
          ip,
        });
        return serializarReserva(await buscarRow(tx, id), viewer, config, agoraAtual);
      });
    },
  };
}

export type ReservasService = ReturnType<typeof createReservasService>;
