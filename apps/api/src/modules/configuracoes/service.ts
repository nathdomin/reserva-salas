import {
  type AtualizarConfiguracoesInput,
  type Configuracoes,
  ERROR_CODES,
  validarConfiguracoes,
} from '@reserva/shared';
import { isPgError, PG_ERROR, type Database } from '../../db/client';
import { AppError } from '../../plugins/errors';
import { registrarAuditoria } from '../audit/service';
import { carregarConfiguracoes } from '../reservas/service';
import type { Ator } from '../users/service';

const TRAVAR_CONFIGURACOES = `select id from reserva.configuracoes where id for update`;

const ATUALIZAR_CONFIGURACOES = `
  update reserva.configuracoes
     set motivo_visivel_para_todos = $1,
         horario_inicio = $2::time,
         horario_fim = $3::time,
         granularidade_minutos = $4,
         duracao_minima_minutos = $5,
         duracao_maxima_minutos = $6,
         antecedencia_maxima_dias = $7,
         intervalo_entre_reunioes_minutos = $8,
         atualizado_por = $9,
         desativar_apos_dias_sem_login = $10,
         max_reservas_futuras_por_pessoa = $11
   where id`;

export function createConfiguracoesService(
  database: Database,
  opcoes: {
    /** Chamado após cada tentativa de alteração (ex.: limpar o cache). */
    aoAlterar?: () => void;
  } = {},
) {
  return {
    /**
     * Aplica as alterações sobre a configuração atual e valida o conjunto.
     * Reservas já feitas não mudam: as novas regras valem para novas reservas e edições.
     */
    async atualizar(ator: Ator, input: AtualizarConfiguracoesInput): Promise<Configuracoes> {
      try {
        return await database.transaction(async (tx) => {
          await tx.query(TRAVAR_CONFIGURACOES);
          const atual = await carregarConfiguracoes(tx);
          const nova: Configuracoes = { ...atual, ...input };

          const erros = validarConfiguracoes(nova);
          if (erros.length > 0) {
            throw new AppError(400, ERROR_CODES.VALIDATION, erros[0]!.mensagem, erros);
          }

          const antes: Record<string, unknown> = {};
          const depois: Record<string, unknown> = {};
          for (const chave of Object.keys(nova) as (keyof Configuracoes)[]) {
            if (nova[chave] !== atual[chave]) {
              antes[chave] = atual[chave];
              depois[chave] = nova[chave];
            }
          }
          if (Object.keys(depois).length === 0) return atual;

          await tx.query(ATUALIZAR_CONFIGURACOES, [
            nova.motivoVisivelParaTodos,
            nova.horarioInicio,
            nova.horarioFim,
            nova.granularidadeMinutos,
            nova.duracaoMinimaMinutos,
            nova.duracaoMaximaMinutos,
            nova.antecedenciaMaximaDias,
            nova.intervaloEntreReunioesMinutos,
            ator.id,
            nova.desativarAposDiasSemLogin,
            nova.maxReservasFuturasPorPessoa,
          ]);
          await registrarAuditoria(tx, {
            atorId: ator.id,
            acao: 'CONFIGURACOES_ALTERADAS',
            entidade: 'configuracao',
            antes,
            depois,
            ip: ator.ip,
          });
          return carregarConfiguracoes(tx);
        });
      } catch (error) {
        // Rede de segurança: as restrições do banco também barram valores inválidos.
        if (isPgError(error, PG_ERROR.CHECK_VIOLATION)) {
          throw new AppError(400, ERROR_CODES.VALIDATION, 'Configuração inválida.');
        }
        throw error;
      } finally {
        opcoes.aoAlterar?.();
      }
    },
  };
}

export type ConfiguracoesService = ReturnType<typeof createConfiguracoesService>;
