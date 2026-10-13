-- =====================================================================
-- MeetKof — usuário do banco só para a aplicação (recomendado em produção)
--
-- Por quê: hoje a API conecta como "postgres", o dono de tudo. Com um usuário próprio,
-- de permissões mínimas, um eventual defeito ou vazamento da senha da aplicação
-- não permite apagar tabelas, desligar a proteção do histórico nem ler outros schemas.
--
-- Permissões do usuário "reserva_app":
--   usuarios, salas, reservas, configuracoes  ler, inserir e alterar (nunca apagar)
--   sessoes                                   ler, inserir, alterar e apagar (logout/expiração)
--   auditoria                                 ler e inserir (nunca alterar nem apagar)
--   migracoes                                 só ler (o servidor avisa se falta migração)
--   Nada mais: não cria tabelas, não altera estrutura, não acessa outros schemas.
--
-- Como usar (Supabase > SQL Editor), DEPOIS de criar as tabelas (supabase.sql ou db:migrate):
--   1. Troque a senha na linha marcada abaixo (mínimo 16 caracteres; guarde-a com segurança).
--   2. Cole TODO o conteúdo e clique em Run.
--   3. No .env: DATABASE_URL com o usuário "reserva_app.<id-do-projeto>" e esta senha, e
--      DATABASE_MIGRATION_URL com o usuário "postgres" (veja docs/BANCO.md).
-- Pode ser executado de novo (por exemplo, para trocar a senha ou após uma nova migração).
-- =====================================================================

begin;

do $$
declare
  -- >>> TROQUE A SENHA AQUI <<<
  senha text := 'TROQUE-ESTA-SENHA';
begin
  if senha = 'TROQUE-ESTA-SENHA' or char_length(senha) < 16 then
    raise exception 'Defina uma senha forte (16+ caracteres) na variável "senha" antes de executar.';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'reserva_app') then
    execute format('create role reserva_app login password %L', senha);
  else
    execute format('alter role reserva_app login password %L', senha);
  end if;
end
$$;

-- As extensões (ex.: btree_gist, da regra que impede reservas sobrepostas) ficam em "extensions".
alter role reserva_app set search_path = "$user", public, extensions;

grant usage on schema reserva to reserva_app;
grant usage on schema extensions to reserva_app;

grant select, insert, update on
  reserva.usuarios, reserva.salas, reserva.reservas, reserva.configuracoes
  to reserva_app;
grant select, insert, update, delete on reserva.sessoes to reserva_app;
grant select, insert on reserva.auditoria to reserva_app;
grant select on reserva.migracoes to reserva_app;
grant usage on all sequences in schema reserva to reserva_app;

-- As tabelas têm RLS ligado (ninguém lê nada sem uma política). Esta política libera
-- o acesso SOMENTE para reserva_app; os papéis públicos do Supabase continuam sem acesso.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'usuarios', 'sessoes', 'salas', 'reservas', 'auditoria', 'configuracoes', 'migracoes'
  ] loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'reserva' and tablename = tabela and policyname = 'acesso_da_aplicacao'
    ) then
      execute format(
        'create policy acesso_da_aplicacao on reserva.%I to reserva_app using (true) with check (true)',
        tabela
      );
    end if;
  end loop;
end
$$;

commit;

-- Conferência: permissões do reserva_app em cada tabela.
select table_name as tabela, string_agg(privilege_type, ', ' order by privilege_type) as permissoes
  from information_schema.role_table_grants
 where grantee = 'reserva_app' and table_schema = 'reserva'
 group by table_name
 order by table_name;
