import { z } from 'zod';
import { PERFIS } from './constants';

export const SENHA_MIN = 10;
export const SENHA_MAX = 128;

/** E-mail sempre normalizado: sem espaços nas pontas e em minúsculas. */
export const emailSchema = z
  .string({ required_error: 'Informe o e-mail.', invalid_type_error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail.')
  .max(254, 'E-mail longo demais.')
  .email('Informe um e-mail válido.');

export const nomeSchema = z
  .string({ required_error: 'Informe o nome.', invalid_type_error: 'Informe o nome.' })
  .trim()
  .min(2, 'Informe o nome completo.')
  .max(120, 'O nome deve ter no máximo 120 caracteres.');

/** Regra para senhas novas. O limite máximo evita abuso no cálculo do hash. */
export const novaSenhaSchema = z
  .string({ required_error: 'Informe a senha.', invalid_type_error: 'Informe a senha.' })
  .min(SENHA_MIN, `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`)
  .max(SENHA_MAX, `A senha deve ter no máximo ${SENHA_MAX} caracteres.`);

const senhaInformadaSchema = z
  .string({ required_error: 'Informe a senha.', invalid_type_error: 'Informe a senha.' })
  .min(1, 'Informe a senha.')
  .max(SENHA_MAX, 'Senha inválida.');

export const perfilSchema = z.enum(PERFIS, {
  errorMap: () => ({ message: 'Perfil inválido.' }),
});

export const loginSchema = z.object({
  email: emailSchema,
  senha: senhaInformadaSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

function senhaDiferenteDoEmail(data: { email?: string; senha?: string }) {
  return !data.email || !data.senha || data.senha.trim().toLowerCase() !== data.email;
}

export const criarUsuarioSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    perfil: perfilSchema.default('COLABORADOR'),
    senha: novaSenhaSchema,
  })
  .refine(senhaDiferenteDoEmail, {
    path: ['senha'],
    message: 'A senha não pode ser igual ao e-mail.',
  });
export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;

export const atualizarUsuarioSchema = z
  .object({
    nome: nomeSchema.optional(),
    email: emailSchema.optional(),
    perfil: perfilSchema.optional(),
    ativo: z.boolean({ invalid_type_error: 'Valor inválido.' }).optional(),
    /** Ao desativar alguém com reservas futuras: cancelar ou manter essas reservas. */
    reservasFuturas: z.enum(['manter', 'cancelar']).optional(),
  })
  .refine(
    ({ reservasFuturas: _decisao, ...campos }) =>
      Object.values(campos).some((value) => value !== undefined),
    { message: 'Nenhuma alteração informada.' },
  );
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;

/**
 * Exclusão de conta (somente administrador). `confirmacao` precisa ser o nome da pessoa,
 * para ninguém excluir alguém por um clique errado.
 */
export const excluirUsuarioSchema = z.object({
  confirmacao: z
    .string({ required_error: 'Digite o nome da pessoa para confirmar.' })
    .trim()
    .min(1, 'Digite o nome da pessoa para confirmar.')
    .max(120),
  /** Se a pessoa tiver reservas futuras: elas são canceladas junto com a exclusão. */
  reservasFuturas: z.enum(['cancelar']).optional(),
});
export type ExcluirUsuarioInput = z.infer<typeof excluirUsuarioSchema>;

/** Compara o nome digitado na confirmação sem diferenciar maiúsculas, acentos nem espaços extras. */
export function nomeConfere(digitado: string, nome: string): boolean {
  const normalizar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  return normalizar(digitado) === normalizar(nome);
}

export const excluirUsuarioResponseSchema = z.object({
  /** apagada: a conta deixou de existir; anonimizada: os dados pessoais foram apagados. */
  modo: z.enum(['apagada', 'anonimizada']),
  reservasCanceladas: z.number(),
});
export type ExcluirUsuarioResponse = z.infer<typeof excluirUsuarioResponseSchema>;

/** Nome exibido no lugar de quem teve a conta excluída. */
export const NOME_USUARIO_REMOVIDO = 'Usuário removido';

export const redefinirSenhaSchema = z.object({ novaSenha: novaSenhaSchema });
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>;

export const alterarSenhaSchema = z
  .object({ senhaAtual: senhaInformadaSchema, novaSenha: novaSenhaSchema })
  .refine((data) => data.novaSenha !== data.senhaAtual, {
    path: ['novaSenha'],
    message: 'A nova senha deve ser diferente da atual.',
  });
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>;

/** Usuário autenticado, como a API devolve em /auth/me e no login. */
export const usuarioSessaoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  email: z.string(),
  perfil: perfilSchema,
  /** Precisa escolher uma senha própria antes de usar o sistema (senha definida pelo admin). */
  trocarSenha: z.boolean().default(false),
});
export type UsuarioSessao = z.infer<typeof usuarioSessaoSchema>;

export const sessaoResponseSchema = z.object({ usuario: usuarioSessaoSchema });

/** Resposta do login: inclui as senhas erradas na conta desde o acesso anterior. */
export const loginResponseSchema = sessaoResponseSchema.extend({
  tentativasSemSucesso: z.number().int().min(0).default(0),
});

/** Usuário como aparece na gestão de usuários (somente administradores). */
export const usuarioAdminSchema = usuarioSessaoSchema.extend({
  ativo: z.boolean(),
  bloqueado: z.boolean(),
  ultimoLoginEm: z.string().nullable(),
  criadoEm: z.string(),
});
export type UsuarioAdmin = z.infer<typeof usuarioAdminSchema>;

export const listaUsuariosResponseSchema = z.object({ usuarios: z.array(usuarioAdminSchema) });
export const usuarioResponseSchema = z.object({ usuario: usuarioAdminSchema });
export const atualizarUsuarioResponseSchema = z.object({
  usuario: usuarioAdminSchema,
  /** Reservas futuras canceladas junto com a desativação. */
  reservasCanceladas: z.number().default(0),
});
