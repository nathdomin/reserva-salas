import type { AcaoAuditoria, EntidadeAuditoria } from '@reserva/shared';
import type { Queryable } from '../../db/client';

export { ACOES_AUDITORIA, type AcaoAuditoria, type EntidadeAuditoria } from '@reserva/shared';

export interface RegistroAuditoria {
  /** Quem fez a ação. null = sistema/terminal ou tentativa sem login. */
  atorId: string | null;
  acao: AcaoAuditoria;
  entidade: EntidadeAuditoria;
  entidadeId?: string | null;
  antes?: Record<string, unknown> | null;
  depois?: Record<string, unknown> | null;
  ip?: string | null;
}

const CHAVES_SENSIVEIS = /senha|hash|token|cookie|password|secret/i;

/** Defesa extra: remove qualquer campo com nome sensível antes de gravar. */
export function semDadosSensiveis(
  dados: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!dados) return null;
  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(dados)) {
    if (!CHAVES_SENSIVEIS.test(chave)) limpo[chave] = valor;
  }
  return limpo;
}

export async function registrarAuditoria(db: Queryable, registro: RegistroAuditoria) {
  const antes = semDadosSensiveis(registro.antes);
  const depois = semDadosSensiveis(registro.depois);
  await db.query(
    `insert into reserva.auditoria (ator_id, acao, entidade, entidade_id, antes, depois, ip)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
    [
      registro.atorId,
      registro.acao,
      registro.entidade,
      registro.entidadeId ?? null,
      antes ? JSON.stringify(antes) : null,
      depois ? JSON.stringify(depois) : null,
      registro.ip ?? null,
    ],
  );
}
