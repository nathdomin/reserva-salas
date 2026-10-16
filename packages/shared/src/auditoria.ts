import { z } from 'zod';
import { dataValida } from './tempo';

export const ACOES_AUDITORIA = [
  'LOGIN_FALHO',
  'CONTA_BLOQUEADA',
  'CONTA_DESBLOQUEADA',
  'SENHA_ALTERADA',
  'USUARIO_CRIADO',
  'USUARIO_ATUALIZADO',
  'USUARIO_DESATIVADO',
  'USUARIO_REATIVADO',
  'USUARIO_DESATIVADO_INATIVIDADE',
  'USUARIO_EXCLUIDO',
  'SENHA_REDEFINIDA',
  'ADMIN_CRIADO_TERMINAL',
  'ADMIN_RECUPERADO_TERMINAL',
  'SALA_CRIADA',
  'SALA_ATUALIZADA',
  'SALA_DESATIVADA',
  'SALA_REATIVADA',
  'RESERVA_CRIADA',
  'RESERVA_ALTERADA',
  'RESERVA_CANCELADA',
  'CONFIGURACOES_ALTERADAS',
] as const;
export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

export const ACAO_AUDITORIA_LABEL: Record<AcaoAuditoria, string> = {
  LOGIN_FALHO: 'Login sem sucesso',
  CONTA_BLOQUEADA: 'Conta bloqueada',
  CONTA_DESBLOQUEADA: 'Conta desbloqueada',
  SENHA_ALTERADA: 'Senha alterada',
  USUARIO_CRIADO: 'Usuário criado',
  USUARIO_ATUALIZADO: 'Usuário alterado',
  USUARIO_DESATIVADO: 'Usuário desativado',
  USUARIO_REATIVADO: 'Usuário reativado',
  USUARIO_DESATIVADO_INATIVIDADE: 'Usuário desativado por falta de uso',
  USUARIO_EXCLUIDO: 'Conta excluída',
  SENHA_REDEFINIDA: 'Senha redefinida',
  ADMIN_CRIADO_TERMINAL: 'Administrador criado (terminal)',
  ADMIN_RECUPERADO_TERMINAL: 'Acesso recuperado (terminal)',
  SALA_CRIADA: 'Sala criada',
  SALA_ATUALIZADA: 'Sala alterada',
  SALA_DESATIVADA: 'Sala desativada',
  SALA_REATIVADA: 'Sala reativada',
  RESERVA_CRIADA: 'Reserva criada',
  RESERVA_ALTERADA: 'Reserva alterada',
  RESERVA_CANCELADA: 'Reserva cancelada',
  CONFIGURACOES_ALTERADAS: 'Configurações alteradas',
};

export const ENTIDADES_AUDITORIA = ['usuario', 'sala', 'reserva', 'configuracao'] as const;
export type EntidadeAuditoria = (typeof ENTIDADES_AUDITORIA)[number];

export const ENTIDADE_AUDITORIA_LABEL: Record<EntidadeAuditoria, string> = {
  usuario: 'Usuários e acesso',
  sala: 'Salas',
  reserva: 'Reservas',
  configuracao: 'Configurações',
};

const data = z.string().refine(dataValida, 'Data inválida (use AAAA-MM-DD).');

/** Filtros da consulta ao histórico (somente administrador). */
export const auditoriaQuerySchema = z
  .object({
    dataInicio: data.optional(),
    dataFim: data.optional(),
    entidade: z.enum(ENTIDADES_AUDITORIA).optional(),
    entidadeId: z.string().max(100).optional(),
    acao: z.enum(ACOES_AUDITORIA).optional(),
    atorId: z.string().uuid('Pessoa inválida.').optional(),
    /** Paginação: traz registros mais antigos que este id. */
    antesDe: z.coerce.number().int().positive().optional(),
    limite: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((q) => !q.dataInicio || !q.dataFim || q.dataFim >= q.dataInicio, {
    path: ['dataFim'],
    message: 'A data final deve ser igual ou posterior à inicial.',
  });
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;

export const registroAuditoriaSchema = z.object({
  id: z.number(),
  acao: z.enum(ACOES_AUDITORIA),
  entidade: z.enum(ENTIDADES_AUDITORIA),
  entidadeId: z.string().nullable(),
  /** Nome legível do que foi afetado (pessoa, sala ou reserva), quando existir. */
  alvo: z.string().nullable(),
  ator: z.object({ id: z.string(), nome: z.string() }).nullable(),
  antes: z.record(z.unknown()).nullable(),
  depois: z.record(z.unknown()).nullable(),
  ip: z.string().nullable(),
  criadoEm: z.string(),
});
export type RegistroAuditoria = z.infer<typeof registroAuditoriaSchema>;

export const listaAuditoriaResponseSchema = z.object({
  registros: z.array(registroAuditoriaSchema),
  /** Valor para `antesDe` da próxima página; null quando não há mais registros. */
  proximo: z.number().nullable(),
});
export type ListaAuditoria = z.infer<typeof listaAuditoriaResponseSchema>;
