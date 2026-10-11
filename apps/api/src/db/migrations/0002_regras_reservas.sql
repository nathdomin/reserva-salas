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
