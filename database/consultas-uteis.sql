-- =====================================================================
-- Reserva de Salas — consultas úteis para o administrador
--
-- Use no Supabase > SQL Editor. Todas são SOMENTE LEITURA (não alteram nada).
-- Horários são exibidos no horário de Brasília. Execute uma consulta por vez
-- (selecione o trecho e clique em Run).
-- =====================================================================

-- 1. Reservas de hoje, por sala e horário
select s.nome as sala,
       to_char(r.inicio at time zone 'America/Sao_Paulo', 'HH24:MI') as inicio,
       to_char(r.fim    at time zone 'America/Sao_Paulo', 'HH24:MI') as fim,
       r.motivo, u.nome as responsavel
  from reserva.reservas r
  join reserva.salas s on s.id = r.sala_id
  join reserva.usuarios u on u.id = r.usuario_id
 where r.status = 'ATIVA'
   and (r.inicio at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
 order by s.nome, r.inicio;

-- 2. Uso das salas nos últimos 30 dias (reuniões e horas reservadas)
select s.nome as sala,
       count(r.id) as reunioes,
       round(coalesce(sum(extract(epoch from (r.fim - r.inicio))) / 3600, 0)::numeric, 1) as horas
  from reserva.salas s
  left join reserva.reservas r
         on r.sala_id = s.id and r.status = 'ATIVA'
        and r.inicio >= now() - interval '30 days' and r.inicio < now()
 group by s.nome
 order by horas desc;

-- 3. Quem mais reservou nos últimos 30 dias
select u.nome, count(*) as reservas,
       count(*) filter (where r.status = 'CANCELADA') as canceladas
  from reserva.reservas r
  join reserva.usuarios u on u.id = r.usuario_id
 where r.criado_em >= now() - interval '30 days'
 group by u.nome
 order by reservas desc
 limit 20;

-- 4. Histórico completo de uma reserva (troque o id)
select to_char(a.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as quando,
       a.acao, coalesce(u.nome, '(sistema)') as quem, a.antes, a.depois
  from reserva.auditoria a
  left join reserva.usuarios u on u.id = a.ator_id
 where a.entidade = 'reserva'
   and a.entidade_id = '00000000-0000-0000-0000-000000000000'
 order by a.id;

-- 5. Administradores ativos (o sistema nunca fica sem nenhum)
select nome, email, ultimo_login_em
  from reserva.usuarios
 where perfil = 'ADMIN' and ativo
 order by nome;

-- 6. Contas bloqueadas agora por tentativas de login
select nome, email,
       to_char(bloqueado_ate at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as bloqueada_ate
  from reserva.usuarios
 where bloqueado_ate > now();

-- 7. Sessões abertas por pessoa (quem está com o sistema aberto)
select u.nome, count(*) as sessoes,
       max(s.ultimo_uso_em) at time zone 'America/Sao_Paulo' as ultimo_uso
  from reserva.sessoes s
  join reserva.usuarios u on u.id = s.usuario_id
 where s.expira_em > now()
 group by u.nome
 order by ultimo_uso desc;

-- 8. Tamanho das tabelas (acompanhar o limite do plano do Supabase)
select t.relname as tabela,
       pg_size_pretty(pg_total_relation_size(c.oid)) as tamanho,
       n_live_tup as linhas
  from pg_class c
  join pg_stat_user_tables t on t.relid = c.oid
 where t.schemaname = 'reserva'
 order by pg_total_relation_size(c.oid) desc;

-- 9. Migrações aplicadas (devem ser as mesmas da pasta apps/api/src/db/migrations)
select nome, aplicada_em from reserva.migracoes order by nome;
