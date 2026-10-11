/**
 * Histórico de alterações, do mais recente para o mais antigo.
 *   $1 desde  $2 até (exclusivo)  $3 entidade  $4 entidade_id  $5 ação  $6 quem fez
 *   $7 paginação (id menor que)  $8 limite
 * `alvo` traz um nome legível do que foi afetado (pessoa, sala ou sala + horário da reserva).
 */
export const LISTAR_AUDITORIA = `
  select a.id, a.acao, a.entidade, a.entidade_id, a.antes, a.depois, a.ip, a.criado_em,
         a.ator_id, ua.nome as ator_nome,
         case a.entidade
           when 'usuario' then ue.nome
           when 'sala' then s.nome
           when 'reserva' then rs.nome || ', '
             || to_char(r.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
         end as alvo
    from reserva.auditoria a
    left join reserva.usuarios ua on ua.id = a.ator_id
    left join reserva.usuarios ue on a.entidade = 'usuario' and ue.id::text = a.entidade_id
    left join reserva.salas s on a.entidade = 'sala' and s.id::text = a.entidade_id
    left join reserva.reservas r on a.entidade = 'reserva' and r.id::text = a.entidade_id
    left join reserva.salas rs on rs.id = r.sala_id
   where ($1::timestamptz is null or a.criado_em >= $1::timestamptz)
     and ($2::timestamptz is null or a.criado_em < $2::timestamptz)
     and ($3::text is null or a.entidade = $3::text)
     and ($4::text is null or a.entidade_id = $4::text)
     and ($5::text is null or a.acao = $5::text)
     and ($6::uuid is null or a.ator_id = $6::uuid)
     and ($7::bigint is null or a.id < $7::bigint)
   order by a.id desc
   limit $8`;
