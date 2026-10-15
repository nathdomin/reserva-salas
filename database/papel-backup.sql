-- =====================================================================
-- MeetKof — usuário do banco SÓ PARA O BACKUP AUTOMÁTICO (GitHub Actions)
--
-- Por quê: o backup diário roda fora da empresa (no GitHub). Com um usuário que só LÊ,
-- um vazamento dessa senha não permite alterar nem apagar nada.
--
-- Permissões do usuário "reserva_backup":
--   usuarios, salas, reservas, configuracoes, auditoria, migracoes   só ler
--   sessoes                                                          nenhuma (não entra no backup)
--   Toda conexão dele é somente leitura (default_transaction_read_only).
--
-- Como usar (Supabase > SQL Editor), DEPOIS de criar as tabelas:
--   1. Cole TODO o conteúdo no SQL Editor e, LÁ, troque a senha na linha marcada abaixo
--      (mínimo 16 caracteres, só letras e números). NUNCA salve a senha neste arquivo:
--      ele vai para o GitHub ("npm run check" recusa o arquivo com a senha trocada).
--   2. Clique em Run e feche a aba sem salvar a consulta.
--   3. No GitHub, guarde a URL com "reserva_backup.<id-do-projeto>" e esta senha no segredo
--      BACKUP_DATABASE_URL (veja docs/MANUTENCAO.md › Backup automático).
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

  if not exists (select 1 from pg_roles where rolname = 'reserva_backup') then
    execute format('create role reserva_backup login password %L', senha);
  else
    execute format('alter role reserva_backup login password %L', senha);
  end if;
end
$$;

alter role reserva_backup set default_transaction_read_only = on;

grant usage on schema reserva to reserva_backup;
grant select on
  reserva.usuarios, reserva.salas, reserva.reservas, reserva.configuracoes,
  reserva.auditoria, reserva.migracoes
  to reserva_backup;

-- As tabelas têm RLS ligado: esta política libera SOMENTE a leitura, SOMENTE para reserva_backup.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'usuarios', 'salas', 'reservas', 'auditoria', 'configuracoes', 'migracoes'
  ] loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'reserva' and tablename = tabela and policyname = 'leitura_do_backup'
    ) then
      execute format(
        'create policy leitura_do_backup on reserva.%I for select to reserva_backup using (true)',
        tabela
      );
    end if;
  end loop;
end
$$;

commit;

-- Conferência: deve listar só SELECT em cada tabela.
select table_name as tabela, string_agg(privilege_type, ', ' order by privilege_type) as permissoes
  from information_schema.role_table_grants
 where grantee = 'reserva_backup' and table_schema = 'reserva'
 group by table_name
 order by table_name;
