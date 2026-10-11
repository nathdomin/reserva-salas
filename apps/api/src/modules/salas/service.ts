import { type AtualizarSalaInput, ERROR_CODES, type Sala, type SalaInput } from '@reserva/shared';
import { isPgError, PG_ERROR, type Database, type Queryable } from '../../db/client';
import { AppError } from '../../plugins/errors';
import { registrarAuditoria } from '../audit/service';
import type { Ator } from '../users/service';
import {
  ATUALIZAR_SALA,
  BUSCAR_SALA,
  BUSCAR_SALA_PARA_ALTERAR,
  CANCELAR_RESERVAS_FUTURAS_DA_SALA,
  CONTAR_RESERVAS_FUTURAS_DA_SALA,
  CRIAR_SALA,
  LISTAR_SALAS,
  RESERVAS_FUTURAS_DA_SALA,
} from './sql';

type SalaRow = {
  id: string;
  nome: string;
  localizacao: string;
  capacidade: number;
  recursos: string[];
  descricao: string | null;
  ativo: boolean;
};

export function toSala(row: SalaRow): Sala {
  return {
    id: row.id,
    nome: row.nome,
    localizacao: row.localizacao,
    capacidade: row.capacidade,
    recursos: row.recursos,
    descricao: row.descricao,
    ativo: row.ativo,
  };
}

export const salaNaoEncontrada = () =>
  new AppError(404, ERROR_CODES.SALA_NAO_ENCONTRADA, 'Sala não encontrada.');

const nomeEmUso = () =>
  new AppError(409, ERROR_CODES.SALA_NOME_EM_USO, 'Já existe uma sala com este nome.', [
    { campo: 'nome', mensagem: 'Já existe uma sala com este nome.' },
  ]);

export async function buscarSala(db: Queryable, id: string, paraAlterar = false): Promise<Sala> {
  const { rows } = await db.query<SalaRow>(paraAlterar ? BUSCAR_SALA_PARA_ALTERAR : BUSCAR_SALA, [
    id,
  ]);
  if (!rows[0]) throw salaNaoEncontrada();
  return toSala(rows[0]);
}

export function createSalasService(database: Database) {
  const db = database.pool;

  return {
    async listar(incluirInativas: boolean): Promise<Sala[]> {
      const { rows } = await db.query<SalaRow>(LISTAR_SALAS, [incluirInativas]);
      return rows.map(toSala);
    },

    buscar: (id: string) => buscarSala(db, id),

    async criar(ator: Ator, dados: SalaInput): Promise<Sala> {
      try {
        return await database.transaction(async (tx) => {
          const { rows } = await tx.query<SalaRow>(CRIAR_SALA, [
            dados.nome,
            dados.localizacao,
            dados.capacidade,
            dados.recursos,
            dados.descricao,
          ]);
          const sala = toSala(rows[0]!);
          await registrarAuditoria(tx, {
            atorId: ator.id,
            acao: 'SALA_CRIADA',
            entidade: 'sala',
            entidadeId: sala.id,
            depois: { ...sala },
            ip: ator.ip,
          });
          return sala;
        });
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION, 'salas_nome_unico')) throw nomeEmUso();
        throw error;
      }
    },

    /**
     * Desativar uma sala com reservas futuras exige decidir o que fazer com elas
     * (`reservasFuturas`: manter ou cancelar). Sem a decisão, a API devolve a lista.
     */
    async atualizar(
      ator: Ator,
      id: string,
      dados: AtualizarSalaInput,
    ): Promise<{ sala: Sala; reservasCanceladas: number }> {
      try {
        return await database.transaction(async (tx) => {
          const atual = await buscarSala(tx, id, true);
          const desativando = atual.ativo && dados.ativo === false;
          let reservasCanceladas = 0;

          if (desativando) {
            const { rows: contagem } = await tx.query<{ total: number }>(
              CONTAR_RESERVAS_FUTURAS_DA_SALA,
              [id],
            );
            const total = contagem[0]?.total ?? 0;
            if (total > 0 && !dados.reservasFuturas) {
              const { rows: futuras } = await tx.query<{
                id: string;
                inicio: Date;
                fim: Date;
                responsavel: string;
              }>(RESERVAS_FUTURAS_DA_SALA, [id]);
              throw new AppError(
                409,
                ERROR_CODES.SALA_COM_RESERVAS_FUTURAS,
                `Esta sala tem ${total} reserva(s) futura(s). Escolha se elas serão mantidas ou canceladas.`,
                {
                  total,
                  reservas: futuras.map((r) => ({
                    id: r.id,
                    inicio: r.inicio.toISOString(),
                    fim: r.fim.toISOString(),
                    responsavel: r.responsavel,
                  })),
                },
              );
            }
            if (total > 0 && dados.reservasFuturas === 'cancelar') {
              const motivo = `Sala ${atual.nome} desativada pela administração.`;
              const { rows: canceladas } = await tx.query<{ id: string }>(
                CANCELAR_RESERVAS_FUTURAS_DA_SALA,
                [id, ator.id, motivo],
              );
              reservasCanceladas = canceladas.length;
              for (const r of canceladas) {
                await registrarAuditoria(tx, {
                  atorId: ator.id,
                  acao: 'RESERVA_CANCELADA',
                  entidade: 'reserva',
                  entidadeId: r.id,
                  depois: { status: 'CANCELADA', motivoCancelamento: motivo },
                  ip: ator.ip,
                });
              }
            }
          }

          const { rows } = await tx.query<SalaRow>(ATUALIZAR_SALA, [
            id,
            dados.nome ?? null,
            dados.localizacao ?? null,
            dados.capacidade ?? null,
            dados.recursos ?? null,
            dados.descricao ?? null,
            dados.descricao !== undefined,
            dados.ativo ?? null,
          ]);
          const sala = toSala(rows[0]!);

          const antes: Record<string, unknown> = {};
          const depois: Record<string, unknown> = {};
          for (const campo of [
            'nome',
            'localizacao',
            'capacidade',
            'recursos',
            'descricao',
            'ativo',
          ] as const) {
            if (JSON.stringify(atual[campo]) !== JSON.stringify(sala[campo])) {
              antes[campo] = atual[campo];
              depois[campo] = sala[campo];
            }
          }
          if (reservasCanceladas > 0) depois.reservasCanceladas = reservasCanceladas;

          if (Object.keys(depois).length > 0) {
            await registrarAuditoria(tx, {
              atorId: ator.id,
              acao: desativando
                ? 'SALA_DESATIVADA'
                : !atual.ativo && sala.ativo
                  ? 'SALA_REATIVADA'
                  : 'SALA_ATUALIZADA',
              entidade: 'sala',
              entidadeId: id,
              antes,
              depois,
              ip: ator.ip,
            });
          }
          return { sala, reservasCanceladas };
        });
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION, 'salas_nome_unico')) throw nomeEmUso();
        throw error;
      }
    },
  };
}

export type SalasService = ReturnType<typeof createSalasService>;
