import { z } from 'zod';

/** Recursos mais comuns, oferecidos como opções na tela. Outros podem ser digitados. */
export const RECURSOS_SUGERIDOS = [
  'Televisão',
  'Projetor',
  'Videoconferência',
  'Quadro branco',
  'Ar-condicionado',
  'Telefone de conferência',
] as const;

const recursosSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Recurso vazio.')
      .max(40, 'Cada recurso deve ter no máximo 40 caracteres.'),
    { invalid_type_error: 'Lista de recursos inválida.' },
  )
  .max(20, 'No máximo 20 recursos.')
  // Remove repetidos sem diferenciar maiúsculas, mantendo a primeira grafia.
  .transform((lista) => {
    const vistos = new Set<string>();
    return lista.filter((item) => {
      const chave = item.toLocaleLowerCase('pt-BR');
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  });

export const salaInputSchema = z.object({
  nome: z
    .string({ required_error: 'Informe o nome da sala.' })
    .trim()
    .min(1, 'Informe o nome da sala.')
    .max(80, 'O nome deve ter no máximo 80 caracteres.'),
  localizacao: z
    .string({ required_error: 'Informe a localização.' })
    .trim()
    .min(1, 'Informe a localização ou o andar.')
    .max(120, 'A localização deve ter no máximo 120 caracteres.'),
  capacidade: z
    .number({
      required_error: 'Informe a capacidade.',
      invalid_type_error: 'Informe a capacidade em número de pessoas.',
    })
    .int('A capacidade deve ser um número inteiro.')
    .min(1, 'A capacidade deve ser de pelo menos 1 pessoa.')
    .max(1000, 'Capacidade acima do permitido.'),
  recursos: recursosSchema.default([]),
  descricao: z
    .string()
    .trim()
    .max(1000, 'A descrição deve ter no máximo 1000 caracteres.')
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type SalaInput = z.infer<typeof salaInputSchema>;

export const atualizarSalaSchema = salaInputSchema
  .partial()
  .extend({
    ativo: z.boolean().optional(),
    /** Ao desativar uma sala com reservas futuras: manter ou cancelar essas reservas. */
    reservasFuturas: z.enum(['manter', 'cancelar']).optional(),
  })
  .refine(
    (d) =>
      Object.entries(d).some(
        ([campo, valor]) => campo !== 'reservasFuturas' && valor !== undefined,
      ),
    { message: 'Nenhuma alteração informada.' },
  );
export type AtualizarSalaInput = z.infer<typeof atualizarSalaSchema>;

export const salaSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  localizacao: z.string(),
  capacidade: z.number(),
  recursos: z.array(z.string()),
  descricao: z.string().nullable(),
  ativo: z.boolean(),
});
export type Sala = z.infer<typeof salaSchema>;

export const listaSalasResponseSchema = z.object({ salas: z.array(salaSchema) });
export const salaResponseSchema = z.object({ sala: salaSchema });
