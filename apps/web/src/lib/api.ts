import { apiErrorSchema } from '@reserva/shared';

/** Erro de API com mensagem já pronta para exibir ao usuário (pt-BR). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NETWORK_MESSAGE =
  'Não foi possível falar com o servidor. Verifique sua conexão ou se o sistema está no ar.';

/**
 * Cliente HTTP mínimo. Sempre envia cookies (sessão) e converte qualquer falha em ApiError
 * com mensagem em português.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_MESSAGE);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(
      response.status,
      'UNKNOWN_ERROR',
      response.status >= 500 ? NETWORK_MESSAGE : 'Não foi possível concluir a operação.',
    );
  }

  return data as T;
}
