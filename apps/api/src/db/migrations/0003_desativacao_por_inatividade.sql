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
