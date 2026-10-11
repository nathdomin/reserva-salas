import { atualizarUsuarioSchema, criarUsuarioSchema, redefinirSenhaSchema } from '@reserva/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { usuarioAtual, type AuthGuards } from '../auth/guards';
import type { Ator, UsersService } from './service';

interface UsersRoutesOptions {
  guards: AuthGuards;
  users: UsersService;
}

const paramsSchema = z.object({
  id: z.string().uuid('Identificador de usuário inválido.'),
});

function ator(request: FastifyRequest): Ator {
  return { id: usuarioAtual(request).id, ip: request.ip };
}

/** Gestão de usuários — todas as rotas exigem perfil de administrador. */
export const usersRoutes: FastifyPluginAsync<UsersRoutesOptions> = async (
  app,
  { guards, users },
) => {
  app.addHook('preHandler', guards.requireAdmin);

  app.get('/', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    return { usuarios: await users.listar() };
  });

  app.post('/', async (request, reply) => {
    const dados = criarUsuarioSchema.parse(request.body ?? {});
    const usuario = await users.criar(ator(request), dados);
    return reply.status(201).send({ usuario });
  });

  app.patch('/:id', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const dados = atualizarUsuarioSchema.parse(request.body ?? {});
    return users.atualizar(ator(request), id, dados);
  });

  app.post('/:id/redefinir-senha', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const { novaSenha } = redefinirSenhaSchema.parse(request.body ?? {});
    await users.redefinirSenha(ator(request), id, novaSenha);
    return reply.status(204).send();
  });
};
