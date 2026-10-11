import type { ApiErrorBody } from '@reserva/shared';
import { ERROR_CODES } from '@reserva/shared';
import type { FastifyError, FastifyInstance, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

/** Erro de negócio com mensagem segura para exibir ao usuário. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return reply.status(statusCode).send(body);
}

/** Mensagens em pt-BR para erros gerados pelo próprio Fastify (que vêm em inglês). */
const FRAMEWORK_MESSAGES: Record<number, string> = {
  400: 'Requisição inválida.',
  404: 'Recurso não encontrado.',
  405: 'Método não permitido.',
  413: 'O conteúdo enviado é grande demais.',
  415: 'Formato de conteúdo não suportado.',
  429: 'Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.',
};

/**
 * Erros do PostgreSQL trazem em `detail` os valores que causaram o problema (ex.: um e-mail
 * repetido). No log ficam só o código, a restrição e a mensagem, sem dados pessoais.
 */
function paraLog(error: unknown): unknown {
  const e = error as { code?: unknown; detail?: unknown; constraint?: unknown; table?: unknown };
  if (typeof e?.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) && 'detail' in e) {
    return {
      type: 'DatabaseError',
      code: e.code,
      constraint: e.constraint,
      table: e.table,
      message: (error as Error).message,
      stack: (error as Error).stack,
    };
  }
  return error;
}

export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | AppError | ZodError, request, reply) => {
    if (error instanceof AppError) {
      return sendError(reply, error.statusCode, error.code, error.message, error.details);
    }

    if (error instanceof ZodError || (error as Error).name === 'ZodError') {
      return sendError(
        reply,
        400,
        ERROR_CODES.VALIDATION,
        'Alguns campos estão inválidos.',
        (error as ZodError).issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensagem: issue.message,
        })),
      );
    }

    const statusCode = error.statusCode ?? 500;

    if (statusCode === 429) {
      return sendError(reply, 429, ERROR_CODES.RATE_LIMIT, FRAMEWORK_MESSAGES[429]!);
    }

    if (statusCode >= 400 && statusCode < 500) {
      return sendError(
        reply,
        statusCode,
        error.code ?? 'BAD_REQUEST',
        FRAMEWORK_MESSAGES[statusCode] ?? 'Requisição inválida.',
      );
    }

    // Erros inesperados: registra detalhes no log, mas nunca os expõe ao cliente.
    request.log.error({ err: paraLog(error) }, 'erro não tratado');
    return sendError(
      reply,
      500,
      ERROR_CODES.INTERNAL,
      'Ocorreu um erro inesperado. Tente novamente em instantes.',
    );
  });
}
