/**
 * Consultas da autenticação. Todas parametrizadas ($1, $2...): nenhum valor do usuário
 * é concatenado no SQL (proteção contra SQL injection).
 */

/**
 * Dados necessários para o login. `bloqueado` é calculado com o relógio do banco.
 * `sem_uso`: colaborador que já passou do prazo sem login e ainda não foi desativado pela
 * rotina periódica (ex.: servidor desligado nesse meio-tempo). Mesma regra de DESATIVAR_SEM_USO.
 */
export const BUSCAR_USUARIO_LOGIN = `
  select u.id, u.nome, u.email, u.perfil, u.ativo, u.senha_hash,
         (u.bloqueado_ate is not null and u.bloqueado_ate > now()) as bloqueado,
         coalesce(u.perfil <> 'ADMIN'
                  and greatest(u.ativado_em, u.ultimo_login_em)
                      < now() - make_interval(days => c.desativar_apos_dias_sem_login),
                  false) as sem_uso
    from reserva.usuarios u
    left join reserva.configuracoes c on c.id
   where u.email = $1`;

/**
 * Registra uma senha errada. Na N-ésima falha seguida ($2), bloqueia por $3 minutos
 * e zera o contador. Atômico: funciona mesmo com tentativas simultâneas.
 */
export const REGISTRAR_FALHA_LOGIN = `
  update reserva.usuarios
     set tentativas_falhas = case when tentativas_falhas + 1 >= $2 then 0
                                  else tentativas_falhas + 1 end,
         bloqueado_ate     = case when tentativas_falhas + 1 >= $2
                                  then now() + make_interval(mins => $3::int)
                                  else bloqueado_ate end
   where id = $1
  returning (bloqueado_ate is not null and bloqueado_ate > now()) as bloqueado`;

export const REGISTRAR_LOGIN_SUCESSO = `
  update reserva.usuarios
     set tentativas_falhas = 0, bloqueado_ate = null, ultimo_login_em = now()
   where id = $1`;

export const ATUALIZAR_HASH_SENHA = `
  update reserva.usuarios set senha_hash = $2 where id = $1`;

export const BUSCAR_HASH_SENHA = `
  select senha_hash from reserva.usuarios where id = $1 and ativo`;

export const ALTERAR_SENHA = `
  update reserva.usuarios
     set senha_hash = $2, senha_alterada_em = now(), tentativas_falhas = 0, bloqueado_ate = null
   where id = $1`;

/** $3 = tempo de inatividade (min). */
export const CRIAR_SESSAO = `
  insert into reserva.sessoes (id, usuario_id, expira_em, ip, user_agent)
  values ($1, $2, now() + make_interval(mins => $3::int), $4, $5)`;

/**
 * Carrega a sessão e o usuário (que precisa estar ativo) em uma única ida ao banco.
 * A CTE renova a sessão (expiração deslizante) no máximo a cada 5 minutos, sem passar
 * do limite absoluto ($3 horas desde o login).
 *   $1 = id (hash do token)  $2 = inatividade (min)  $3 = duração máxima (h)
 */
export const CARREGAR_SESSAO = `
  with renovacao as (
    update reserva.sessoes
       set ultimo_uso_em = now(),
           expira_em = least(now() + make_interval(mins => $2::int),
                             criado_em + make_interval(hours => $3::int))
     where id = $1
       and expira_em > now()
       and criado_em > now() - make_interval(hours => $3::int)
       and ultimo_uso_em < now() - interval '5 minutes'
  )
  select u.id, u.nome, u.email, u.perfil
    from reserva.sessoes s
    join reserva.usuarios u on u.id = s.usuario_id
   where s.id = $1
     and s.expira_em > now()
     and s.criado_em > now() - make_interval(hours => $3::int)
     and u.ativo`;

export const REMOVER_SESSAO = `
  delete from reserva.sessoes where id = $1`;

/** Encerra todas as sessões de um usuário, exceto (opcionalmente) a atual ($2). */
export const REMOVER_SESSOES_DO_USUARIO = `
  delete from reserva.sessoes
   where usuario_id = $1 and ($2::text is null or id <> $2::text)`;

export const LIMPAR_SESSOES_EXPIRADAS = `
  delete from reserva.sessoes
   where expira_em <= now() or criado_em <= now() - make_interval(hours => $1::int)`;
