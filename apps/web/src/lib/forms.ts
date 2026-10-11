import type { ZodError } from 'zod';
import { ApiError } from './api';

export type FieldErrors = Record<string, string>;

/** Primeira mensagem de cada campo, a partir da validação local (zod). */
export function zodFieldErrors(error: ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const campo = issue.path.join('.') || '_';
    result[campo] ??= issue.message;
  }
  return result;
}

/** Erros por campo devolvidos pela API (`details: [{ campo, mensagem }]`). */
export function apiFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  const result: FieldErrors = {};
  for (const item of error.details as { campo?: unknown; mensagem?: unknown }[]) {
    if (typeof item?.campo === 'string' && typeof item.mensagem === 'string') {
      result[item.campo] ??= item.mensagem;
    }
  }
  return result;
}

/** Mensagem geral para exibir no topo do formulário. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Não foi possível concluir a operação. Tente novamente.';
}
