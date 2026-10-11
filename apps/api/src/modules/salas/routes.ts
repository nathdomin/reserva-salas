import { atualizarSalaSchema, ERROR_CODES, salaInputSchema } from '@reserva/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../plugins/errors';
import { usuarioAtual, type AuthGuards } from '../auth/guards';
import type { Ator } from '../users/service';
import type { SalasService } from './service';

interface SalasRoutesOptions {
  guards: AuthGuards;
  salas: SalasService;
}

const paramsSchema = z.object({ id: z.string().uuid('Identificador de sala inválido.') });
const listarQuerySchema = z.object({ incluirInativas: z.enum(['true', 'false']).optional() });

function ator(request: FastifyRequest): Ator {
  return { id: usuarioAtual(request).id, ip: request.ip };
}

/** Consulta de salas: qualquer pessoa logada. */
export const salasRoutes: FastifyPluginAsync<SalasRoutesOptions> = async (app, opts) => {
  app.addHook('preHandler', opts.guards.requireAuth);

  app.get('/', async (request) => {
    const { incluirInativas } = listarQuerySchema.parse(request.query);
    // Só o administrador vê salas desativadas na lista.
    const incluir = incluirInativas === 'true' && usuarioAtual(request).perfil === 'ADMIN';
    return { salas: await opts.salas.listar(incluir) };
  });

  app.get('/:id', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const sala = await opts.salas.buscar(id);
    // Sala desativada só aparece para o administrador.
    if (!sala.ativo && usuarioAtual(request).perfil !== 'ADMIN') {
      throw new AppError(404, ERROR_CODES.SALA_NAO_ENCONTRADA, 'Sala não encontrada.');
    }
    return { sala };
  });
};

/** Cadastro e alteração de salas: somente administradores. */
export const adminSalasRoutes: FastifyPluginAsync<SalasRoutesOptions> = async (app, opts) => {
  app.addHook('preHandler', opts.guards.requireAdmin);

  app.post('/', async (request, reply) => {
    const dados = salaInputSchema.parse(request.body ?? {});
    const sala = await opts.salas.criar(ator(request), dados);
    return reply.status(201).send({ sala });
  });

  app.patch('/:id', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const dados = atualizarSalaSchema.parse(request.body ?? {});
    return opts.salas.atualizar(ator(request), id, dados);
  });
};
