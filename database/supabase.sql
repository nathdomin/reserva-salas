-- =====================================================================
-- MeetKof — estrutura completa do banco (PostgreSQL / Supabase)
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
select pg_advisory_xact_lock(727301);

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

-- ---------------------------------------------------------------------
-- 0001_modelo_inicial.sql
-- ---------------------------------------------------------------------
do $migracao$
declare
  aplicado text;
begin
  select checksum into aplicado from reserva.migracoes where nome = '0001_modelo_inicial.sql';
  if aplicado is not null then
    if aplicado <> 'd16d74cb623736d1b4a8fc4beb251594036202dc8d17bc8f8c580d4e26f7f40f' then
      raise exception 'A migração 0001_modelo_inicial.sql foi alterada depois de aplicada.';
    end if;
    raise notice 'já aplicada: 0001_modelo_inicial.sql';
    return;
  end if;

  execute $sql_0001$
-- =====================================================================
-- 0001 — Modelo inicial do sistema de reserva de salas
--
-- Todas as tabelas ficam no schema "reserva", que NÃO é exposto pela
-- Data API do Supabase. Só a API deste projeto (conectada como dona das
-- tabelas) lê e grava os dados.
-- O executor de migrações define: search_path = reserva, extensions, public
-- =====================================================================

create schema if not exists reserva;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type reserva.perfil as enum ('COLABORADOR', 'ADMIN');
create type reserva.status_reserva as enum ('ATIVA', 'CANCELADA');

-- Atualiza "atualizado_em" automaticamente em qualquer UPDATE.
create function reserva.definir_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------------
create table reserva.usuarios (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  -- Sempre gravado em minúsculas pela API: a unicidade não depende de maiúsculas.
  email              text not null,
  senha_hash         text not null,
  perfil             reserva.perfil not null default 'COLABORADOR',
  ativo              boolean not null default true,
  tentativas_falhas  integer not null default 0,
  bloqueado_ate      timestamptz,
  ultimo_login_em    timestamptz,
  senha_alterada_em  timestamptz not null default now(),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),

  constraint usuarios_email_unico unique (email),
  constraint usuarios_email_minusculo check (email = lower(email)),
  constraint usuarios_email_formato check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint usuarios_nome_tamanho check (char_length(btrim(nome)) between 2 and 120),
  constraint usuarios_tentativas_validas check (tentativas_falhas >= 0)
);

create trigger usuarios_atualizado_em
  before update on reserva.usuarios
  for each row execute function reserva.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Sessões de login (o token puro fica só no cookie do navegador;
-- aqui guardamos apenas o hash SHA-256 dele)
-- ---------------------------------------------------------------------
create table reserva.sessoes (
  id             text primary key,
  usuario_id     uuid not null references reserva.usuarios (id) on delete cascade,
  criado_em      timestamptz not null default now(),
  expira_em      timestamptz not null,
  ultimo_uso_em  timestamptz not null default now(),
  ip             text,
  user_agent     text,

  constraint sessoes_id_formato check (id ~ '^[0-9a-f]{64}$')
);

create index sessoes_usuario_idx on reserva.sessoes (usuario_id);
create index sessoes_expira_idx on reserva.sessoes (expira_em);

-- ---------------------------------------------------------------------
-- Salas
-- ---------------------------------------------------------------------
create table reserva.salas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  localizacao    text not null,
  capacidade     integer not null,
  recursos       text[] not null default '{}',
  descricao      text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  constraint salas_nome_tamanho check (char_length(btrim(nome)) between 1 and 80),
  constraint salas_localizacao_tamanho check (char_length(btrim(localizacao)) between 1 and 120),
  constraint salas_capacidade_valida check (capacidade between 1 and 1000),
  constraint salas_descricao_tamanho check (descricao is null or char_length(descricao) <= 1000)
);

-- Nome único sem diferenciar maiúsculas ("Sala 1" = "sala 1").
create unique index salas_nome_unico on reserva.salas (lower(btrim(nome)));

create trigger salas_atualizado_em
  before update on reserva.salas
  for each row execute function reserva.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------
create table reserva.reservas (
  id                   uuid primary key default gen_random_uuid(),
  sala_id              uuid not null references reserva.salas (id) on delete restrict,
  usuario_id           uuid not null references reserva.usuarios (id) on delete restrict,
  motivo               text not null,
  participantes        integer,
  inicio               timestamptz not null,
  fim                  timestamptz not null,
  status               reserva.status_reserva not null default 'ATIVA',
  cancelada_em         timestamptz,
  cancelada_por        uuid references reserva.usuarios (id) on delete restrict,
  motivo_cancelamento  text,
  versao               integer not null default 1,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),

  constraint reservas_periodo_valido check (fim > inicio),
  constraint reservas_motivo_tamanho check (char_length(btrim(motivo)) between 3 and 200),
  constraint reservas_participantes_validos check (participantes is null or participantes between 1 and 1000),
  constraint reservas_cancelamento_consistente check (
    (status = 'CANCELADA') = (cancelada_em is not null)
  ),
  -- PRINCIPAL REGRA DO SISTEMA: duas reservas ATIVAS da mesma sala não podem
  -- se sobrepor. Intervalo [início, fim): 10h–11h e 11h–12h são permitidas.
  -- A verificação acontece no próprio banco, então vale mesmo com dois
  -- usuários reservando ao mesmo tempo.
  constraint reservas_sem_conflito exclude using gist (
    sala_id with =,
    tstzrange(inicio, fim, '[)') with &&
  ) where (status = 'ATIVA')
);

create index reservas_usuario_inicio_idx on reserva.reservas (usuario_id, inicio);
create index reservas_sala_inicio_idx on reserva.reservas (sala_id, inicio);

create trigger reservas_atualizado_em
  before update on reserva.reservas
  for each row execute function reserva.definir_atualizado_em();

-- ---------------------------------------------------------------------
-- Auditoria (somente inserção)
-- ---------------------------------------------------------------------
create table reserva.auditoria (
  id           bigint generated always as identity primary key,
  ator_id      uuid references reserva.usuarios (id) on delete restrict,
  acao         text not null,
  entidade     text not null,
  entidade_id  text,
  antes        jsonb,
  depois       jsonb,
  ip           text,
  criado_em    timestamptz not null default now()
);

create index auditoria_criado_idx on reserva.auditoria (criado_em desc);
create index auditoria_entidade_idx on reserva.auditoria (entidade, entidade_id);
create index auditoria_ator_idx on reserva.auditoria (ator_id);

create function reserva.auditoria_somente_insercao() returns trigger
language plpgsql as $$
begin
  raise exception 'Registros de auditoria não podem ser alterados nem apagados.';
end;
$$;

create trigger auditoria_imutavel
  before update or delete on reserva.auditoria
  for each row execute function reserva.auditoria_somente_insercao();

-- ---------------------------------------------------------------------
-- Configurações (uma única linha)
-- ---------------------------------------------------------------------
create table reserva.configuracoes (
  id                                boolean primary key default true,
  motivo_visivel_para_todos         boolean not null default false,
  horario_inicio                    time not null default '07:00',
  horario_fim                       time not null default '20:00',
  granularidade_minutos             integer not null default 15,
  duracao_minima_minutos            integer not null default 15,
  duracao_maxima_minutos            integer not null default 480,
  antecedencia_maxima_dias          integer not null default 90,
  intervalo_entre_reunioes_minutos  integer not null default 0,
  atualizado_em                     timestamptz not null default now(),
  atualizado_por                    uuid references reserva.usuarios (id) on delete restrict,

  constraint configuracoes_linha_unica check (id),
  constraint configuracoes_horario_valido check (horario_fim > horario_inicio),
  constraint configuracoes_granularidade check (granularidade_minutos in (5, 10, 15, 30, 60)),
  constraint configuracoes_duracao check (
    duracao_minima_minutos >= 5 and duracao_maxima_minutos >= duracao_minima_minutos
    and duracao_maxima_minutos <= 1440
  ),
  constraint configuracoes_antecedencia check (antecedencia_maxima_dias between 1 and 730),
  constraint configuracoes_intervalo check (intervalo_entre_reunioes_minutos between 0 and 60)
);

create trigger configuracoes_atualizado_em
  before update on reserva.configuracoes
  for each row execute function reserva.definir_atualizado_em();

insert into reserva.configuracoes default values;

-- ---------------------------------------------------------------------
-- Segurança
-- ---------------------------------------------------------------------
-- RLS ligado em todas as tabelas, sem políticas: nenhum papel além do dono
-- (a API) consegue ler ou gravar linhas, mesmo que receba permissão por engano.
alter table reserva.usuarios      enable row level security;
alter table reserva.sessoes       enable row level security;
alter table reserva.salas         enable row level security;
alter table reserva.reservas      enable row level security;
alter table reserva.auditoria     enable row level security;
alter table reserva.configuracoes enable row level security;

revoke all on schema reserva from public;
revoke execute on all functions in schema reserva from public;

-- Papéis da Data API do Supabase (só existem no Supabase).
do $$
declare
  papel text;
begin
  foreach papel in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on schema reserva from %I', papel);
      execute format('revoke all on all tables in schema reserva from %I', papel);
      execute format('revoke all on all sequences in schema reserva from %I', papel);
      execute format('revoke all on all functions in schema reserva from %I', papel);
      execute format('alter default privileges in schema reserva revoke all on tables from %I', papel);
      execute format('alter default privileges in schema reserva revoke all on functions from %I', papel);
    end if;
  end loop;
end;
$$;
$sql_0001$;

  insert into reserva.migracoes (nome, checksum) values ('0001_modelo_inicial.sql', 'd16d74cb623736d1b4a8fc4beb251594036202dc8d17bc8f8c580d4e26f7f40f');
  raise notice 'aplicada: 0001_modelo_inicial.sql';
end
$migracao$;

-- ---------------------------------------------------------------------
-- 0002_regras_reservas.sql
-- ---------------------------------------------------------------------
do $migracao$
declare
  aplicado text;
begin
  select checksum into aplicado from reserva.migracoes where nome = '0002_regras_reservas.sql';
  if aplicado is not null then
    if aplicado <> '6a8b59240e924033c4afdbc9ce88293d50aec869c223ff7dd1cdd14b0864bc8b' then
      raise exception 'A migração 0002_regras_reservas.sql foi alterada depois de aplicada.';
    end if;
    raise notice 'já aplicada: 0002_regras_reservas.sql';
    return;
  end if;

  execute $sql_0002$
-- =====================================================================
-- 0002 — Ajustes de regras solicitados antes da Etapa 4
--   * Antecedência máxima: 120 dias
--   * Motivo da reunião visível para todos os colaboradores (padrão)
--   * Reserva de "dia inteiro" (todo o horário de funcionamento)
-- =====================================================================

alter table reserva.configuracoes
  alter column antecedencia_maxima_dias set default 120,
  alter column motivo_visivel_para_todos set default true;

update reserva.configuracoes
   set antecedencia_maxima_dias = 120,
       motivo_visivel_para_todos = true
 where id;

-- Reserva que ocupa todo o horário de funcionamento do dia. O início e o fim continuam
-- gravados normalmente, então a regra contra conflitos vale do mesmo jeito.
alter table reserva.reservas
  add column dia_inteiro boolean not null default false;

-- Consultas do calendário por período (todas as salas).
create index reservas_inicio_idx on reserva.reservas (inicio);
$sql_0002$;

  insert into reserva.migracoes (nome, checksum) values ('0002_regras_reservas.sql', '6a8b59240e924033c4afdbc9ce88293d50aec869c223ff7dd1cdd14b0864bc8b');
  raise notice 'aplicada: 0002_regras_reservas.sql';
end
$migracao$;

-- ---------------------------------------------------------------------
-- 0003_desativacao_por_inatividade.sql
-- ---------------------------------------------------------------------
do $migracao$
declare
  aplicado text;
begin
  select checksum into aplicado from reserva.migracoes where nome = '0003_desativacao_por_inatividade.sql';
  if aplicado is not null then
    if aplicado <> '8daccfcf636c7783299601dd97a32757b87c749e345dae70f2ff5627c0d7c8c2' then
      raise exception 'A migração 0003_desativacao_por_inatividade.sql foi alterada depois de aplicada.';
    end if;
    raise notice 'já aplicada: 0003_desativacao_por_inatividade.sql';
    return;
  end if;

  execute $sql_0003$
-- =====================================================================
-- 0003 — Desativação automática de contas sem uso
--   * Colaborador que não entra no sistema há N dias é desativado sozinho
--     (quem saiu da empresa perde o acesso mesmo que ninguém se lembre de desativá-lo).
--   * null = desligado. Administradores nunca são desativados por este motivo.
-- =====================================================================

alter table reserva.configuracoes
  add column desativar_apos_dias_sem_login integer default 60,
  add constraint configuracoes_desativacao_inatividade check (
    desativar_apos_dias_sem_login is null or desativar_apos_dias_sem_login between 15 and 365
  );

-- Quando a conta passou a valer: criação ou reativação. A contagem dos dias sem uso parte
-- do mais recente entre este instante e o último login. Contas existentes começam a contar
-- agora (ninguém é desativado no dia em que esta migração é aplicada).
alter table reserva.usuarios
  add column ativado_em timestamptz not null default now();
$sql_0003$;

  insert into reserva.migracoes (nome, checksum) values ('0003_desativacao_por_inatividade.sql', '8daccfcf636c7783299601dd97a32757b87c749e345dae70f2ff5627c0d7c8c2');
  raise notice 'aplicada: 0003_desativacao_por_inatividade.sql';
end
$migracao$;

commit;

-- Conferência: deve listar todas as migrações.
select nome, aplicada_em from reserva.migracoes order by nome;
