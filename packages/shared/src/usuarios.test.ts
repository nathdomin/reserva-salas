import { describe, expect, it } from 'vitest';
import {
  alterarSenhaSchema,
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  loginSchema,
} from './usuarios';

describe('validações de usuário', () => {
  it('login normaliza o e-mail (espaços e maiúsculas)', () => {
    expect(loginSchema.parse({ email: '  Ana@Empresa.COM ', senha: 'x' })).toEqual({
      email: 'ana@empresa.com',
      senha: 'x',
    });
  });

  it('login recusa e-mail inválido e senha vazia, com mensagens em português', () => {
    const r = loginSchema.safeParse({ email: 'ana', senha: '' });
    expect(r.success).toBe(false);
    const mensagens = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(mensagens).toContain('Informe um e-mail válido.');
    expect(mensagens).toContain('Informe a senha.');
  });

  it('criar usuário aplica perfil padrão e limpa espaços do nome', () => {
    const r = criarUsuarioSchema.parse({
      nome: '  Bia Lima ',
      email: 'bia@empresa.com',
      senha: 'senha-segura-1',
    });
    expect(r).toEqual({
      nome: 'Bia Lima',
      email: 'bia@empresa.com',
      perfil: 'COLABORADOR',
      senha: 'senha-segura-1',
    });
  });

  it('senha precisa ter de 10 a 128 caracteres e ser diferente do e-mail', () => {
    const base = { nome: 'Bia Lima', email: 'bia.lima@empresa.com' };
    expect(criarUsuarioSchema.safeParse({ ...base, senha: '123456789' }).success).toBe(false);
    expect(criarUsuarioSchema.safeParse({ ...base, senha: 'x'.repeat(129) }).success).toBe(false);
    expect(criarUsuarioSchema.safeParse({ ...base, senha: 'Bia.Lima@empresa.com' }).success).toBe(
      false,
    );
    expect(criarUsuarioSchema.safeParse({ ...base, senha: '1234567890' }).success).toBe(true);
  });

  it('perfil precisa ser um dos perfis existentes', () => {
    const r = criarUsuarioSchema.safeParse({
      nome: 'Bia Lima',
      email: 'bia@empresa.com',
      senha: 'senha-segura-1',
      perfil: 'SUPERUSUARIO',
    });
    expect(r.success).toBe(false);
  });

  it('atualizar exige ao menos um campo', () => {
    expect(atualizarUsuarioSchema.safeParse({}).success).toBe(false);
    expect(atualizarUsuarioSchema.safeParse({ ativo: false }).success).toBe(true);
  });

  it('a nova senha precisa ser diferente da atual', () => {
    const r = alterarSenhaSchema.safeParse({
      senhaAtual: 'mesma-senha-1',
      novaSenha: 'mesma-senha-1',
    });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0]?.path[0]).toBe('novaSenha');
  });
});
