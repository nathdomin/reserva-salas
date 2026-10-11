import {
  cancelarReservaSchema,
  dataValida,
  editarReservaSchema,
  ERROR_CODES,
  reservaInputSchema,
  somarDias,
} from '@reserva/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../plugins/errors';
import { usuarioAtual, type AuthGuards } from '../auth/guards';
import type { ReservasService } from './service';

interface ReservasRoutesOptions {
  guards: AuthGuards;
  reservas: ReservasService;
}

const MAX_DIAS_CONSULTA = 62;

const paramsSchema = z.object({ id: z.string().uuid('Identificador de reserva inválido.') });

const data = z.string().refine(dataValida, 'Data inválida (use AAAA-MM-DD).');

const periodoQuerySchema = z
  .object({
    dataInicio: data,
    dataFim: data,
    salaId: z.string().uuid('Sala inválida.').optional(),
    usuarioId: z.string().uuid('Responsável inválido.').optional(),
    incluirCanceladas: z.enum(['true', 'false']).optional(),
  })
  .refine((q) => q.dataFim >= q.dataInicio, {
    path: ['dataFim'],
    message: 'A data final deve ser igual ou posterior à inicial.',
  })
  .refine((q) => q.dataFim <= somarDias(q.dataInicio, MAX_DIAS_CONSULTA), {
    path: ['dataFim'],
    message: `Consulte no máximo ${MAX_DIAS_CONSULTA} dias por vez.`,
  });

const minhasQuerySchema = z.object({
  tipo: z.enum(['proximas', 'anteriores']).default('proximas'),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

/** Configurações de funcionamento: qualquer pessoa logada pode ler. */
export const configuracoesRoutes: FastifyPluginAsync<ReservasRoutesOptions> = async (app, opts) => {
  app.get('/configuracoes', { preHandler: opts.guards.requireAuth }, async () => ({
    configuracoes: await opts.reservas.configuracoes(),
  }));
};

export const reservasRoutes: FastifyPluginAsync<ReservasRoutesOptions> = async (app, opts) => {
  const { reservas } = opts;
  app.addHook('preHandler', opts.guards.requireAuth);

  app.get('/', async (request, reply) => {
    const q = periodoQuerySchema.parse(request.query);
    reply.header('cache-control', 'no-store');
    return {
      reservas: await reservas.listarPeriodo(usuarioAtual(request), {
        dataInicio: q.dataInicio,
        dataFim: q.dataFim,
        salaId: q.salaId,
        usuarioId: q.usuarioId,
        incluirCanceladas: q.incluirCanceladas === 'true',
      }),
    };
  });

  app.get('/minhas', async (request, reply) => {
    const { tipo, limite } = minhasQuerySchema.parse(request.query);
    reply.header('cache-control', 'no-store');
    return { reservas: await reservas.minhas(usuarioAtual(request), tipo, limite) };
  });

  app.get('/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    reply.header('cache-control', 'no-store');
    return { reserva: await reservas.buscar(usuarioAtual(request), id) };
  });

  app.post('/', async (request, reply) => {
    const dados = reservaInputSchema.parse(request.body ?? {});
    const reserva = await reservas.criar(usuarioAtual(request), request.ip, dados);
    return reply.status(201).send({ reserva });
  });

  app.patch('/:id', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const dados = editarReservaSchema.parse(request.body ?? {});
    return { reserva: await reservas.editar(usuarioAtual(request), request.ip, id, dados) };
  });

  app.post('/:id/cancelar', async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const { motivo } = cancelarReservaSchema.parse(request.body ?? {});
    return {
      reserva: await reservas.cancelar(usuarioAtual(request), request.ip, id, motivo),
    };
  });

  // Exclusão física não existe: reservas são canceladas e o histórico é preservado.
  app.delete('/:id', async () => {
    throw new AppError(
      405,
      ERROR_CODES.OPERACAO_NAO_PERMITIDA,
      'Reservas não são apagadas. Use o cancelamento.',
    );
  });
};
