import { atualizarConfiguracoesSchema } from '@reserva/shared';
import type { FastifyPluginAsync } from 'fastify';
import { usuarioAtual, type AuthGuards } from '../auth/guards';
import type { ConfiguracoesService } from './service';

/** Alteração das regras de funcionamento — somente administradores. */
export const adminConfiguracoesRoutes: FastifyPluginAsync<{
  guards: AuthGuards;
  configuracoes: ConfiguracoesService;
}> = async (app, opts) => {
  app.addHook('preHandler', opts.guards.requireAdmin);

  app.patch('/', async (request) => {
    const dados = atualizarConfiguracoesSchema.parse(request.body ?? {});
    const ator = { id: usuarioAtual(request).id, ip: request.ip };
    return { configuracoes: await opts.configuracoes.atualizar(ator, dados) };
  });
};
