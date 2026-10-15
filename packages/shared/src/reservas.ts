import { z } from 'zod';
import { STATUS_RESERVA } from './constants';
import { dataValida, emMinutos, HORA_REGEX } from './tempo';

export const MOTIVO_OCULTO = 'Reservado';

/** Configurações de funcionamento (lidas por todos; alteradas só pelo administrador). */
export const configuracoesSchema = z.object({
  motivoVisivelParaTodos: z.boolean(),
  horarioInicio: z.string(),
  horarioFim: z.string(),
  granularidadeMinutos: z.number(),
  duracaoMinimaMinutos: z.number(),
  duracaoMaximaMinutos: z.number(),
  antecedenciaMaximaDias: z.number(),
  intervaloEntreReunioesMinutos: z.number(),
  /** Colaborador sem login há este número de dias é desativado. null = desligado. */
  desativarAposDiasSemLogin: z.number().nullable(),
});
export type Configuracoes = z.infer<typeof configuracoesSchema>;
export const configuracoesResponseSchema = z.object({ configuracoes: configuracoesSchema });

export const GRANULARIDADES = [5, 10, 15, 30, 60] as const;

const inteiro = (rotulo: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `Informe ${rotulo}.`, required_error: `Informe ${rotulo}.` })
    .int(`Informe ${rotulo} em número inteiro.`)
    .min(min, `O valor mínimo é ${min}.`)
    .max(max, `O valor máximo é ${max}.`);

/** Alteração das configurações (somente administrador). Todos os campos são opcionais. */
export const atualizarConfiguracoesSchema = z
  .object({
    motivoVisivelParaTodos: z.boolean(),
    horarioInicio: z.string().regex(HORA_REGEX, 'Informe um horário válido (HH:MM).'),
    horarioFim: z.string().regex(HORA_REGEX, 'Informe um horário válido (HH:MM).'),
    granularidadeMinutos: z
      .number()
      .refine(
        (v) => (GRANULARIDADES as readonly number[]).includes(v),
        'Escolha 5, 10, 15, 30 ou 60 minutos.',
      ),
    duracaoMinimaMinutos: inteiro('a duração mínima', 5, 1440),
    duracaoMaximaMinutos: inteiro('a duração máxima', 5, 1440),
    antecedenciaMaximaDias: inteiro('a antecedência máxima', 1, 730),
    intervaloEntreReunioesMinutos: inteiro('o intervalo entre reuniões', 0, 60),
    desativarAposDiasSemLogin: inteiro('o número de dias', 15, 365).nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Informe pelo menos uma configuração para alterar.');
export type AtualizarConfiguracoesInput = z.infer<typeof atualizarConfiguracoesSchema>;

/**
 * Regras que dependem de mais de um campo (usadas no formulário e na API,
 * sobre a configuração completa já com as alterações aplicadas).
 */
export function validarConfiguracoes(c: Configuracoes): { campo: string; mensagem: string }[] {
  const erros: { campo: string; mensagem: string }[] = [];
  const g = c.granularidadeMinutos;
  const inicio = emMinutos(c.horarioInicio);
  const fim = emMinutos(c.horarioFim);
  if (fim <= inicio) {
    erros.push({ campo: 'horarioFim', mensagem: 'O fim do expediente deve ser depois do início.' });
  }
  if (inicio % g !== 0) {
    erros.push({ campo: 'horarioInicio', mensagem: `Use um horário múltiplo de ${g} minutos.` });
  }
  if (fim % g !== 0) {
    erros.push({ campo: 'horarioFim', mensagem: `Use um horário múltiplo de ${g} minutos.` });
  }
  if (c.duracaoMinimaMinutos < g || c.duracaoMinimaMinutos % g !== 0) {
    erros.push({
      campo: 'duracaoMinimaMinutos',
      mensagem: `A duração mínima deve ser múltipla de ${g} minutos (no mínimo ${g}).`,
    });
  }
  if (c.duracaoMaximaMinutos % g !== 0) {
    erros.push({
      campo: 'duracaoMaximaMinutos',
      mensagem: `A duração máxima deve ser múltipla de ${g} minutos.`,
    });
  }
  if (c.duracaoMaximaMinutos < c.duracaoMinimaMinutos) {
    erros.push({
      campo: 'duracaoMaximaMinutos',
      mensagem: 'A duração máxima deve ser maior ou igual à mínima.',
    });
  }
  if (fim > inicio && c.duracaoMaximaMinutos > fim - inicio) {
    erros.push({
      campo: 'duracaoMaximaMinutos',
      mensagem: `A duração máxima não pode passar do expediente (${fim - inicio} minutos).`,
    });
  }
  return erros;
}

const horaOpcional = z
  .string()
  .regex(HORA_REGEX, 'Informe um horário válido.')
  .optional()
  .nullable()
  .transform((v) => v ?? undefined);

/** Dados de uma reserva como o formulário envia (datas e horas no horário de Brasília). */
export const reservaInputSchema = z
  .object({
    salaId: z.string({ required_error: 'Selecione a sala.' }).uuid('Selecione a sala.'),
    data: z
      .string({ required_error: 'Informe a data.' })
      .refine(dataValida, 'Informe uma data válida.'),
    diaInteiro: z.boolean().default(false),
    horaInicio: horaOpcional,
    horaFim: horaOpcional,
    motivo: z
      .string({ required_error: 'Informe o motivo da reunião.' })
      .trim()
      .min(3, 'Descreva o motivo da reunião (mínimo de 3 caracteres).')
      .max(200, 'O motivo deve ter no máximo 200 caracteres.'),
    participantes: z
      .number({ invalid_type_error: 'Informe um número de participantes.' })
      .int('Informe um número inteiro.')
      .min(1, 'Informe pelo menos 1 participante.')
      .max(1000, 'Número de participantes acima do permitido.')
      .nullish()
      .transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (d.diaInteiro) return;
    if (!d.horaInicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['horaInicio'],
        message: 'Informe o horário de início.',
      });
    }
    if (!d.horaFim) {
      ctx.addIssue({ code: 'custom', path: ['horaFim'], message: 'Informe o horário de término.' });
    }
    if (d.horaInicio && d.horaFim && emMinutos(d.horaFim) <= emMinutos(d.horaInicio)) {
      ctx.addIssue({
        code: 'custom',
        path: ['horaFim'],
        message: 'O término deve ser depois do início.',
      });
    }
  });
export type ReservaInput = z.infer<typeof reservaInputSchema>;
export type ReservaInputBruto = z.input<typeof reservaInputSchema>;

/** Edição: os mesmos campos + a versão vista pelo usuário (evita sobrescrever alteração alheia). */
export const editarReservaSchema = z.intersection(
  reservaInputSchema,
  z.object({ versao: z.number().int().min(1) }),
);
export type EditarReservaInput = z.infer<typeof editarReservaSchema>;

export const cancelarReservaSchema = z.object({
  motivo: z
    .string()
    .trim()
    .max(200, 'O motivo deve ter no máximo 200 caracteres.')
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const reservaSchema = z.object({
  id: z.string().uuid(),
  sala: z.object({ id: z.string().uuid(), nome: z.string(), localizacao: z.string() }),
  responsavel: z.object({ id: z.string().uuid(), nome: z.string() }),
  /** "Reservado" quando o motivo está oculto para quem consulta. */
  motivo: z.string(),
  motivoOculto: z.boolean(),
  participantes: z.number().nullable(),
  inicio: z.string(),
  fim: z.string(),
  diaInteiro: z.boolean(),
  status: z.enum(STATUS_RESERVA),
  canceladaEm: z.string().nullable(),
  motivoCancelamento: z.string().nullable(),
  versao: z.number(),
  /** Permissões de quem consulta (a API valida de novo em cada operação). */
  podeEditar: z.boolean(),
  podeCancelar: z.boolean(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type Reserva = z.infer<typeof reservaSchema>;

export const reservaResponseSchema = z.object({ reserva: reservaSchema });
export const listaReservasResponseSchema = z.object({ reservas: z.array(reservaSchema) });

/** Detalhes do erro 409 de conflito, com alternativas para o usuário. */
export const conflitoDetalhesSchema = z.object({
  conflitos: z.array(z.object({ inicio: z.string(), fim: z.string() })),
  sugestoes: z.object({
    horarios: z.array(z.object({ horaInicio: z.string(), horaFim: z.string() })),
    salas: z.array(
      z.object({
        id: z.string().uuid(),
        nome: z.string(),
        localizacao: z.string(),
        capacidade: z.number(),
      }),
    ),
  }),
});
export type ConflitoDetalhes = z.infer<typeof conflitoDetalhesSchema>;
