import { healthResponseSchema, type HealthResponse } from '@reserva/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';

/**
 * O health check responde 200 (tudo ok) ou 503 (banco indisponível) — os dois com o mesmo
 * formato. Por isso não usa o apiFetch, que trataria o 503 como erro genérico.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'O servidor da aplicação não respondeu.');
  }
  const parsed = healthResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      'UNEXPECTED_RESPONSE',
      'O servidor da aplicação não respondeu.',
    );
  }
  return parsed.data;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: false,
  });
}
