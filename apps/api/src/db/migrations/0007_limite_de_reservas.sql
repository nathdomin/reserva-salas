-- =====================================================================
-- 0007 — Limite de reservas futuras por pessoa
--   Um colaborador pode ter no máximo N reservas ativas que ainda não começaram (padrão 30).
--   Vale só para criar reservas novas: as que já existem não são canceladas.
--   null = sem limite. Administradores nunca são limitados.
-- =====================================================================

alter table reserva.configuracoes
  add column max_reservas_futuras_por_pessoa integer default 30,
  add constraint configuracoes_limite_reservas check (
    max_reservas_futuras_por_pessoa is null or max_reservas_futuras_por_pessoa between 1 and 500
  );
