import {
  type AcaoAuditoria,
  auditoriaQuerySchema,
  type AuditoriaQuery,
  type EntidadeAuditoria,
  type ListaAuditoria,
  paraInstante,
  somarDias,
} from '@reserva/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Database } from '../../db/client';
import type { AuthGuards } from '../auth/guards';
import { LISTAR_AUDITORIA } from './sql';

type AuditoriaRow = {
  id: string; // bigint chega como texto do pg
  acao: AcaoAuditoria;
  entidade: EntidadeAuditoria;
  entidade_id: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  ip: string | null;
  criado_em: Date;
  ator_id: string | null;
  ator_nome: string | null;
  alvo: string | null;
};

export function createAuditoriaService(database: Database) {
  return {
    async listar(q: AuditoriaQuery): Promise<ListaAuditoria> {
      // Busca um a mais para saber se existe próxima página.
      const { rows } = await database.pool.query<AuditoriaRow>(LISTAR_AUDITORIA, [
        q.dataInicio ? paraInstante(q.dataInicio, '00:00') : null,
        q.dataFim ? paraInstante(somarDias(q.dataFim, 1), '00:00') : null,
        q.entidade ?? null,
        q.entidadeId ?? null,
        q.acao ?? null,
        q.atorId ?? null,
        q.antesDe ?? null,
        q.limite + 1,
      ]);
      const pagina = rows.slice(0, q.limite);
      const ultimo = pagina.at(-1);
      return {
        registros: pagina.map((r) => ({
          id: Number(r.id),
          acao: r.acao,
          entidade: r.entidade,
          entidadeId: r.entidade_id,
          alvo: r.alvo,
          ator: r.ator_id ? { id: r.ator_id, nome: r.ator_nome ?? '' } : null,
          antes: r.antes,
          depois: r.depois,
          ip: r.ip,
          criadoEm: r.criado_em.toISOString(),
        })),
        proximo: rows.length > q.limite && ultimo ? Number(ultimo.id) : null,
      };
    },
  };
}

export type AuditoriaService = ReturnType<typeof createAuditoriaService>;

/** Histórico de alterações — somente administradores. */
export const auditoriaRoutes: FastifyPluginAsync<{
  guards: AuthGuards;
  auditoria: AuditoriaService;
}> = async (app, opts) => {
  app.addHook('preHandler', opts.guards.requireAdmin);

  app.get('/', async (request, reply) => {
    const q = auditoriaQuerySchema.parse(request.query);
    reply.header('cache-control', 'no-store');
    return opts.auditoria.listar(q);
  });
};
