/** Campos devolvidos na gestão de usuários. Nunca inclui senha_hash. */
const CAMPOS_USUARIO = `
  id, nome, email, perfil, ativo,
  (bloqueado_ate is not null and bloqueado_ate > now()) as bloqueado,
  ultimo_login_em, criado_em`;

export const LISTAR_USUARIOS = `
  select ${CAMPOS_USUARIO}
    from reserva.usuarios
   order by ativo desc, lower(nome)`;

export const BUSCAR_USUARIO = `
  select ${CAMPOS_USUARIO}
    from reserva.usuarios
   where id = $1`;

/** Mesmo que BUSCAR_USUARIO, mas trava a linha até o fim da transação. */
export const BUSCAR_USUARIO_PARA_ALTERAR = `
  select ${CAMPOS_USUARIO}
    from reserva.usuarios
   where id = $1
     for update`;

export const BUSCAR_ID_POR_EMAIL = `
  select id from reserva.usuarios where email = $1`;

export const CRIAR_USUARIO = `
  insert into reserva.usuarios (nome, email, perfil, senha_hash)
  values ($1, $2, $3::reserva.perfil, $4)
  returning ${CAMPOS_USUARIO}`;

/** Campos null não são alterados. Reativar recomeça a contagem de dias sem uso. */
export const ATUALIZAR_USUARIO = `
  update reserva.usuarios
     set nome   = coalesce($2::text, nome),
         email  = coalesce($3::text, email),
         perfil = coalesce($4::reserva.perfil, perfil),
         ativo  = coalesce($5::boolean, ativo),
         ativado_em = case when $5::boolean and not ativo then now() else ativado_em end
   where id = $1
  returning ${CAMPOS_USUARIO}`;

export const REDEFINIR_SENHA = `
  update reserva.usuarios
     set senha_hash = $2, senha_alterada_em = now(), tentativas_falhas = 0, bloqueado_ate = null
   where id = $1`;

/** Usado pelo comando do terminal para recuperar o acesso de administrador. */
export const PROMOVER_E_REDEFINIR = `
  update reserva.usuarios
     set nome = $2, perfil = 'ADMIN', ativo = true, senha_hash = $3,
         senha_alterada_em = now(), tentativas_falhas = 0, bloqueado_ate = null,
         ativado_em = case when ativo then ativado_em else now() end
   where id = $1
  returning ${CAMPOS_USUARIO}`;

/**
 * Desativa colaboradores sem login há mais dias que o configurado (nada, se desligado).
 * A contagem parte do último login ou da criação/reativação da conta, o que for mais recente.
 * Administradores nunca entram: o sistema não pode ficar sem quem o administra.
 */
export const DESATIVAR_SEM_USO = `
  with alvos as (
    select u.id
      from reserva.usuarios u
      join reserva.configuracoes c on c.id
     where c.desativar_apos_dias_sem_login is not null
       and u.ativo
       and u.perfil <> 'ADMIN'
       and greatest(u.ativado_em, u.ultimo_login_em)
           < now() - make_interval(days => c.desativar_apos_dias_sem_login)
       for update of u skip locked
  )
  update reserva.usuarios u
     set ativo = false
    from alvos, reserva.configuracoes c
   where u.id = alvos.id and c.id
  returning u.id, u.nome, greatest(u.ativado_em, u.ultimo_login_em) as ultimo_acesso,
            c.desativar_apos_dias_sem_login as dias`;

/**
 * Serializa operações que podem remover administradores: duas alterações simultâneas
 * não conseguem, juntas, deixar o sistema sem nenhum administrador ativo.
 */
export const TRAVAR_ADMINISTRADORES = `
  select pg_advisory_xact_lock(hashtext('reserva.administradores'))`;

export const CONTAR_OUTROS_ADMINS_ATIVOS = `
  select count(*)::int as total
    from reserva.usuarios
   where perfil = 'ADMIN' and ativo and id <> $1`;

export const CONTAR_ADMINS_ATIVOS = `
  select count(*)::int as total
    from reserva.usuarios
   where perfil = 'ADMIN' and ativo`;

/** Reservas ativas do usuário que ainda não começaram. */
export const RESERVAS_FUTURAS_DO_USUARIO = `
  select r.id, r.inicio, r.fim, s.nome as sala
    from reserva.reservas r
    join reserva.salas s on s.id = r.sala_id
   where r.usuario_id = $1 and r.status = 'ATIVA' and r.inicio > now()
   order by r.inicio
   limit 50`;

export const CONTAR_RESERVAS_FUTURAS_DO_USUARIO = `
  select count(*)::int as total
    from reserva.reservas
   where usuario_id = $1 and status = 'ATIVA' and inicio > now()`;

/** $2 = quem cancela, $3 = motivo do cancelamento. */
export const CANCELAR_RESERVAS_FUTURAS_DO_USUARIO = `
  update reserva.reservas
     set status = 'CANCELADA', cancelada_em = now(), cancelada_por = $2,
         motivo_cancelamento = $3, versao = versao + 1
   where usuario_id = $1 and status = 'ATIVA' and inicio > now()
  returning id`;
