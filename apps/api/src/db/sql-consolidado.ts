import { MIGRATION_LOCK_ID, type MigrationFile } from './migrate';

/**
 * Gera um único script SQL com todas as migrações, para colar no SQL Editor do Supabase
 * (alternativa ao `npm run db:migrate`, que não exige Node).
 *
 * O script faz exatamente o que o executor de migrações faz: aplica cada migração uma vez,
 * na mesma ordem, e a registra em `reserva.migracoes` com o mesmo checksum. Por isso:
 *  - pode ser executado várias vezes (o que já foi aplicado é pulado);
 *  - depois dele, `npm run db:migrate` reconhece tudo como aplicado e não duplica nada;
 *  - se uma migração aplicada tiver sido alterada, o script para com erro.
 */
export function gerarSqlConsolidado(migracoes: MigrationFile[]): string {
  const partes: string[] = [
    `-- =====================================================================
-- Reserva de Salas — estrutura completa do banco (PostgreSQL / Supabase)
--
-- ARQUIVO GERADO por "npm run db:sql" a partir de apps/api/src/db/migrations.
-- Não edite à mão: altere as migrações e gere de novo.
--
-- Como usar: Supabase > SQL Editor > New query > cole TODO o conteúdo > Run.
-- Pode ser executado mais de uma vez: o que já existe não é recriado.
-- Equivale a "npm run db:setup" + "npm run db:migrate".
-- =====================================================================

begin;

-- Impede duas execuções ao mesmo tempo (o mesmo bloqueio usado por "npm run db:migrate").
select pg_advisory_xact_lock(${MIGRATION_LOCK_ID});

-- Extensões (no Supabase o schema "extensions" já existe).
create schema if not exists extensions;
-- btree_gist: restrição que impede duas reservas da mesma sala no mesmo horário.
create extension if not exists btree_gist with schema extensions;

-- Controle de migrações aplicadas.
create schema if not exists reserva;
create table if not exists reserva.migracoes (
  nome        text primary key,
  checksum    text not null,
  aplicada_em timestamptz not null default now()
);
alter table reserva.migracoes enable row level security;

set local search_path to reserva, extensions, public;
`,
  ];

  for (const m of migracoes) {
    const etiqueta = `$sql_${m.nome.slice(0, 4)}$`;
    if (m.sql.includes(etiqueta)) {
      throw new Error(`A migração ${m.nome} contém o delimitador ${etiqueta}.`);
    }
    partes.push(`
-- ---------------------------------------------------------------------
-- ${m.nome}
-- ---------------------------------------------------------------------
do $migracao$
declare
  aplicado text;
begin
  select checksum into aplicado from reserva.migracoes where nome = '${m.nome}';
  if aplicado is not null then
    if aplicado <> '${m.checksum}' then
      raise exception 'A migração ${m.nome} foi alterada depois de aplicada.';
    end if;
    raise notice 'já aplicada: ${m.nome}';
    return;
  end if;

  execute ${etiqueta}
${m.sql.trimEnd()}
${etiqueta};

  insert into reserva.migracoes (nome, checksum) values ('${m.nome}', '${m.checksum}');
  raise notice 'aplicada: ${m.nome}';
end
$migracao$;
`);
  }

  partes.push(`
commit;

-- Conferência: deve listar todas as migrações.
select nome, aplicada_em from reserva.migracoes order by nome;
`);
  return partes.join('');
}
