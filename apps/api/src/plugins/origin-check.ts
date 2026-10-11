import { ERROR_CODES } from '@reserva/shared';
import type { FastifyInstance } from 'fastify';
import { sendError } from './errors';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defesa contra CSRF (complementa o cookie de sessão SameSite=Strict):
 * requisições que alteram dados vindas de um navegador precisam ter a origem do próprio sistema.
 * Clientes que não são navegadores (scripts, testes) não enviam Origin nem Sec-Fetch-Site
 * e não são alvo de CSRF.
 */
export function registerOriginCheck(app: FastifyInstance, allowedOrigin: string) {
  app.addHook('onRequest', async (request, reply) => {
    if (!UNSAFE_METHODS.has(request.method)) return;

    const origin = request.headers.origin;
    const fetchSite = request.headers['sec-fetch-site'];

    const foreignOrigin = origin !== undefined && origin !== allowedOrigin;
    const crossSite = fetchSite === 'cross-site';

    if (foreignOrigin || crossSite) {
      request.log.warn({ origin, fetchSite }, 'requisição bloqueada por origem não permitida');
      return sendError(
        reply,
        403,
        ERROR_CODES.FORBIDDEN_ORIGIN,
        'Origem da requisição não permitida.',
      );
    }
  });
}
