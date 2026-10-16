-- =====================================================================
-- 0004 — Bloqueio progressivo de login
--   A cada série de 5 senhas erradas, a conta fica bloqueada por um tempo que dobra:
--   1, 2, 4, 8 e no máximo 15 minutos. Um login certo, a troca de senha ou o
--   administrador (botão "Desbloquear") zeram a sequência.
--   Assim, alguém que erra a senha de outra pessoa de propósito só a trava por pouco tempo,
--   e a pessoa é avisada das tentativas no próximo login.
-- =====================================================================

alter table reserva.usuarios
  add column bloqueios_seguidos integer not null default 0,
  add constraint usuarios_bloqueios_validos check (bloqueios_seguidos >= 0);
