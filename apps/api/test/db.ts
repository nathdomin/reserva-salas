import type { Perfil } from '@reserva/shared';
import type pg from 'pg';
import { runMigrations } from '../src/db/migrate';
import { hashPassword } from '../src/modules/auth/password';

let migrated = false;

/** Aplica as migrações (uma vez por execução) e esvazia as tabelas do banco de TESTE. */
export async function resetDatabase(pool: pg.Pool) {
  if (!migrated) {
    await runMigrations(pool);
    migrated = true;
  }
  // CASCADE também esvazia "configuracoes" (referencia usuarios): a linha padrão é recriada.
  await pool.query(`
    truncate reserva.sessoes, reserva.reservas, reserva.salas,
             reserva.auditoria, reserva.usuarios
      restart identity cascade;
    insert into reserva.configuracoes default values on conflict do nothing;
  `);
}

const hashCache = new Map<string, Promise<string>>();

/** Hash com cache: o scrypt é lento de propósito, e os testes reutilizam poucas senhas. */
function cachedHash(senha: string) {
  let hash = hashCache.get(senha);
  if (!hash) {
    hash = hashPassword(senha);
    hashCache.set(senha, hash);
  }
  return hash;
}

export const SENHA_PADRAO = 'senha-de-teste-123';

export interface UsuarioTeste {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  senha: string;
}

export async function criarUsuarioTeste(
  pool: pg.Pool,
  dados: Partial<Omit<UsuarioTeste, 'id'>> & { ativo?: boolean } = {},
): Promise<UsuarioTeste> {
  const usuario = {
    nome: dados.nome ?? 'Pessoa Teste',
    email: dados.email ?? `pessoa.${Math.random().toString(36).slice(2, 10)}@empresa.com`,
    perfil: dados.perfil ?? ('COLABORADOR' as Perfil),
    senha: dados.senha ?? SENHA_PADRAO,
  };
  const { rows } = await pool.query<{ id: string }>(
    `insert into reserva.usuarios (nome, email, perfil, senha_hash, ativo)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      usuario.nome,
      usuario.email,
      usuario.perfil,
      await cachedHash(usuario.senha),
      dados.ativo ?? true,
    ],
  );
  return { id: rows[0]!.id, ...usuario };
}

export interface SalaTeste {
  id: string;
  nome: string;
  capacidade: number;
}

export async function criarSalaTeste(
  pool: pg.Pool,
  dados: { nome?: string; capacidade?: number; ativo?: boolean; localizacao?: string } = {},
): Promise<SalaTeste> {
  const nome = dados.nome ?? `Sala ${Math.random().toString(36).slice(2, 8)}`;
  const capacidade = dados.capacidade ?? 8;
  const { rows } = await pool.query<{ id: string }>(
    `insert into reserva.salas (nome, localizacao, capacidade, ativo)
     values ($1, $2, $3, $4) returning id`,
    [nome, dados.localizacao ?? '2º andar', capacidade, dados.ativo ?? true],
  );
  return { id: rows[0]!.id, nome, capacidade };
}
