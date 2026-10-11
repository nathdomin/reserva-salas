import { z } from 'zod';

/**
 * Formato padrão de erro devolvido pela API.
 * `code` é estável (para lógica no cliente); `message` é texto em pt-BR para o usuário.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['ok', 'indisponivel']),
  timestamp: z.string().datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Códigos de erro conhecidos pela API. */
export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL: 'INTERNAL_ERROR',
  FORBIDDEN_ORIGIN: 'FORBIDDEN_ORIGIN',
  NAO_AUTENTICADO: 'NAO_AUTENTICADO',
  SEM_PERMISSAO: 'SEM_PERMISSAO',
  CREDENCIAIS_INVALIDAS: 'CREDENCIAIS_INVALIDAS',
  CONTA_BLOQUEADA: 'CONTA_BLOQUEADA',
  USUARIO_INATIVO: 'USUARIO_INATIVO',
  SENHA_ATUAL_INCORRETA: 'SENHA_ATUAL_INCORRETA',
  EMAIL_EM_USO: 'EMAIL_EM_USO',
  USUARIO_NAO_ENCONTRADO: 'USUARIO_NAO_ENCONTRADO',
  OPERACAO_NAO_PERMITIDA: 'OPERACAO_NAO_PERMITIDA',
  SALA_NAO_ENCONTRADA: 'SALA_NAO_ENCONTRADA',
  SALA_NOME_EM_USO: 'SALA_NOME_EM_USO',
  SALA_INATIVA: 'SALA_INATIVA',
  SALA_COM_RESERVAS_FUTURAS: 'SALA_COM_RESERVAS_FUTURAS',
  USUARIO_COM_RESERVAS_FUTURAS: 'USUARIO_COM_RESERVAS_FUTURAS',
  RESERVA_NAO_ENCONTRADA: 'RESERVA_NAO_ENCONTRADA',
  RESERVA_CONFLITO: 'RESERVA_CONFLITO',
  RESERVA_ALTERADA: 'RESERVA_ALTERADA',
  RESERVA_NAO_EDITAVEL: 'RESERVA_NAO_EDITAVEL',
  HORARIO_INVALIDO: 'HORARIO_INVALIDO',
  CAPACIDADE_EXCEDIDA: 'CAPACIDADE_EXCEDIDA',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
