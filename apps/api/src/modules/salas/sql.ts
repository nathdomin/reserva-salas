const CAMPOS_SALA = `id, nome, localizacao, capacidade, recursos, descricao, ativo`;

/** $1 = incluir salas inativas. */
export const LISTAR_SALAS = `
  select ${CAMPOS_SALA}
    from reserva.salas
   where ($1::boolean or ativo)
   order by ativo desc, lower(nome)`;

export const BUSCAR_SALA = `
  select ${CAMPOS_SALA} from reserva.salas where id = $1`;

export const BUSCAR_SALA_PARA_ALTERAR = `
  select ${CAMPOS_SALA} from reserva.salas where id = $1 for update`;

export const CRIAR_SALA = `
  insert into reserva.salas (nome, localizacao, capacidade, recursos, descricao)
  values ($1, $2, $3, $4::text[], $5)
  returning ${CAMPOS_SALA}`;

/** Campos null não mudam. A descrição usa um indicador ($7) para poder ser apagada. */
export const ATUALIZAR_SALA = `
  update reserva.salas
     set nome        = coalesce($2::text, nome),
         localizacao = coalesce($3::text, localizacao),
         capacidade  = coalesce($4::int, capacidade),
         recursos    = coalesce($5::text[], recursos),
         descricao   = case when $7::boolean then $6::text else descricao end,
         ativo       = coalesce($8::boolean, ativo)
   where id = $1
  returning ${CAMPOS_SALA}`;

/** Reservas ativas que ainda não começaram. */
export const RESERVAS_FUTURAS_DA_SALA = `
  select r.id, r.inicio, r.fim, u.nome as responsavel
    from reserva.reservas r
    join reserva.usuarios u on u.id = r.usuario_id
   where r.sala_id = $1 and r.status = 'ATIVA' and r.inicio > now()
   order by r.inicio
   limit 50`;

export const CONTAR_RESERVAS_FUTURAS_DA_SALA = `
  select count(*)::int as total
    from reserva.reservas
   where sala_id = $1 and status = 'ATIVA' and inicio > now()`;

/** $2 = quem cancela, $3 = motivo do cancelamento. */
export const CANCELAR_RESERVAS_FUTURAS_DA_SALA = `
  update reserva.reservas
     set status = 'CANCELADA', cancelada_em = now(), cancelada_por = $2,
         motivo_cancelamento = $3, versao = versao + 1
   where sala_id = $1 and status = 'ATIVA' and inicio > now()
  returning id`;
