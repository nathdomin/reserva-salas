import type { HealthResponse } from '@reserva/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Database } from '../../db/client';

interface HealthOptions {
  database: Database;
}

export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (app, { database }) => {
  // A tela inicial consulta esta rota a cada 30 s: registrar só avisos e erros dela.
  app.get('/health', { logLevel: 'warn' }, async (request, reply) => {
    let databaseOk = true;
    try {
      await database.ping();
    } catch (error) {
      databaseOk = false;
      request.log.warn({ err: error }, 'banco de dados indisponível no health check');
    }

    const body: HealthResponse = {
      status: databaseOk ? 'ok' : 'degraded',
      database: databaseOk ? 'ok' : 'indisponivel',
      timestamp: new Date().toISOString(),
    };

    return reply
      .status(databaseOk ? 200 : 503)
      .header('cache-control', 'no-store')
      .send(body);
  });
};
