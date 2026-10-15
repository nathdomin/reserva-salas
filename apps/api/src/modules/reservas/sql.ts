export const BUSCAR_CONFIGURACOES = `
  select motivo_visivel_para_todos,
         to_char(horario_inicio, 'HH24:MI') as horario_inicio,
         to_char(horario_fim, 'HH24:MI') as horario_fim,
         granularidade_minutos, duracao_minima_minutos, duracao_maxima_minutos,
         antecedencia_maxima_dias, intervalo_entre_reunioes_minutos,
         desativar_apos_dias_sem_login
    from reserva.configuracoes
   where id`;

/** Reserva com nome da sala e do responsável, lida de `origem` (a tabela ou uma CTE). */
const selectReserva = (origem: string) => `
  select r.id, r.sala_id, s.nome as sala_nome, s.localizacao as sala_localizacao,
         r.usuario_id, u.nome as usuario_nome, r.motivo, r.participantes,
         r.inicio, r.fim, r.dia_inteiro, r.status, r.cancelada_em, r.motivo_cancelamento,
         r.versao, r.criado_em, r.atualizado_em
    from ${origem} r
    join reserva.salas s on s.id = r.sala_id
    join reserva.usuarios u on u.id = r.usuario_id`;

const SELECT_RESERVA = selectReserva('reserva.reservas');

export const BUSCAR_RESERVA = `${SELECT_RESERVA} where r.id = $1`;

export const BUSCAR_RESERVA_PARA_ALTERAR = `${SELECT_RESERVA} where r.id = $1 for update of r`;

/**
 * Reservas que se sobrepõem a um período (calendário, filtros do administrador).
 *   $1 início  $2 fim  $3 sala (opcional)  $4 responsável (opcional)  $5 incluir canceladas
 */
export const LISTAR_RESERVAS_PERIODO = `${SELECT_RESERVA}
   where r.inicio < $2 and r.fim > $1
     and ($3::uuid is null or r.sala_id = $3::uuid)
     and ($4::uuid is null or r.usuario_id = $4::uuid)
     and ($5::boolean or r.status = 'ATIVA')
   order by r.inicio, s.nome
   limit 2000`;

export const MINHAS_PROXIMAS = `${SELECT_RESERVA}
   where r.usuario_id = $1 and r.status = 'ATIVA' and r.fim > now()
   order by r.inicio
   limit $2`;

export const MINHAS_ANTERIORES = `${SELECT_RESERVA}
   where r.usuario_id = $1 and (r.fim <= now() or r.status = 'CANCELADA')
   order by r.inicio desc
   limit $2`;

/** Trava (compartilhada) a linha de quem reserva: a desativação dessa pessoa espera. */
export const TRAVAR_USUARIO = `
  select ativo from reserva.usuarios where id = $1 for share`;

/**
 * Reservas ativas da sala que conflitam com o período, considerando o intervalo mínimo
 * entre reuniões ($5 min). $4 = reserva a ignorar (a própria, na edição).
 */
export const CONFLITOS = `
  select id, inicio, fim
    from reserva.reservas
   where sala_id = $1
     and status = 'ATIVA'
     and ($4::uuid is null or id <> $4::uuid)
     and tstzrange(inicio - make_interval(mins => $5::int),
                   fim + make_interval(mins => $5::int), '[)')
         && tstzrange($2::timestamptz, $3::timestamptz, '[)')
   order by inicio`;

/** Horários ocupados da sala em um dia ($2..$3), para sugerir alternativas. */
export const OCUPADOS_NO_PERIODO = `
  select inicio, fim
    from reserva.reservas
   where sala_id = $1 and status = 'ATIVA'
     and ($4::uuid is null or id <> $4::uuid)
     and inicio < $3 and fim > $2`;

/** Outras salas ativas, com capacidade suficiente, livres no período. */
export const SALAS_LIVRES = `
  select s.id, s.nome, s.localizacao, s.capacidade
    from reserva.salas s
   where s.ativo
     and s.id <> $1
     and s.capacidade >= coalesce($4::int, 1)
     and not exists (
       select 1 from reserva.reservas r
        where r.sala_id = s.id and r.status = 'ATIVA'
          and tstzrange(r.inicio - make_interval(mins => $5::int),
                        r.fim + make_interval(mins => $5::int), '[)')
              && tstzrange($2::timestamptz, $3::timestamptz, '[)'))
   order by s.capacidade, lower(s.nome)
   limit 5`;

// Criar, alterar e cancelar devolvem a reserva completa na mesma consulta (uma ida ao banco
// a menos que gravar e depois ler).

export const CRIAR_RESERVA = `
  with gravada as (
    insert into reserva.reservas
      (sala_id, usuario_id, motivo, participantes, inicio, fim, dia_inteiro)
    values ($1, $2, $3, $4, $5, $6, $7)
    returning *
  )
  ${selectReserva('gravada')}`;

/** Atualiza só se a versão ainda for a que o usuário viu ($8). Sem linha = outra pessoa alterou. */
export const ATUALIZAR_RESERVA = `
  with gravada as (
    update reserva.reservas
       set sala_id = $2, motivo = $3, participantes = $4, inicio = $5, fim = $6,
           dia_inteiro = $7, versao = versao + 1
     where id = $1 and versao = $8 and status = 'ATIVA'
    returning *
  )
  ${selectReserva('gravada')}`;

export const CANCELAR_RESERVA = `
  with gravada as (
    update reserva.reservas
       set status = 'CANCELADA', cancelada_em = now(), cancelada_por = $2,
           motivo_cancelamento = $3, versao = versao + 1
     where id = $1 and status = 'ATIVA'
    returning *
  )
  ${selectReserva('gravada')}`;
