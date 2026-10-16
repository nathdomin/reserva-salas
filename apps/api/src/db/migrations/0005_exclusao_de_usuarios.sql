-- =====================================================================
-- 0005 — Exclusão de contas pelo administrador
--   * Conta SEM histórico (nunca reservou nem fez nada registrado): é apagada de verdade.
--   * Conta COM histórico: é anonimizada (nome, e-mail e senha apagados). As reservas e o
--     histórico continuam, atribuídos a "Usuário removido". As chaves estrangeiras impedem
--     que uma conta com histórico seja apagada por engano.
-- =====================================================================

-- Quando a conta foi anonimizada. Conta removida não aparece na lista nem pode ser reativada.
alter table reserva.usuarios
  add column removido_em timestamptz,
  add constraint usuarios_removido_inativo check (removido_em is null or not ativo);

-- O usuário da aplicação (database/papel-aplicacao.sql) passa a poder apagar usuários.
-- Só os sem histórico conseguem ser apagados: os demais são barrados pelas chaves estrangeiras.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'reserva_app') then
    grant delete on reserva.usuarios to reserva_app;
  end if;
end;
$$;
