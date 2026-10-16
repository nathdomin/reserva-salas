-- =====================================================================
-- 0006 — Troca de senha obrigatória no primeiro acesso
--   Quando o administrador cria a conta ou redefine a senha, ele conhece a senha da pessoa.
--   Com trocar_senha = true, a pessoa só consegue usar o sistema depois de escolher a
--   própria senha (a API recusa as outras rotas até lá).
-- =====================================================================

alter table reserva.usuarios
  add column trocar_senha boolean not null default false;

-- Contas que já existem: precisa trocar quem ainda usa a senha definida pelo administrador,
-- isto é, cujo último evento de senha no histórico foi a criação da conta ou uma
-- redefinição pelo administrador (e não uma troca feita pela própria pessoa ou pelo
-- comando do terminal). Conta sem nenhum desses eventos não é alterada.
update reserva.usuarios u
   set trocar_senha = true
 where u.removido_em is null
   and (select a.acao
          from reserva.auditoria a
         where a.entidade = 'usuario'
           and a.entidade_id = u.id::text
           and a.acao in ('USUARIO_CRIADO', 'SENHA_REDEFINIDA', 'SENHA_ALTERADA',
                          'ADMIN_CRIADO_TERMINAL', 'ADMIN_RECUPERADO_TERMINAL')
         order by a.id desc
         limit 1) in ('USUARIO_CRIADO', 'SENHA_REDEFINIDA');
