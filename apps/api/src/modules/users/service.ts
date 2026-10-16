import {
  type AtualizarUsuarioInput,
  type CriarUsuarioInput,
  ERROR_CODES,
  type ExcluirUsuarioInput,
  type ExcluirUsuarioResponse,
  NOME_USUARIO_REMOVIDO,
  nomeConfere,
  type Perfil,
  type UsuarioAdmin,
} from '@reserva/shared';
import { isPgError, PG_ERROR, type Database, type Queryable } from '../../db/client';
import { AppError } from '../../plugins/errors';
import { registrarAuditoria } from '../audit/service';
import { hashPassword } from '../auth/password';
import { DESBLOQUEAR_USUARIO, REMOVER_SESSOES_DO_USUARIO } from '../auth/sql';
import {
  ANONIMIZAR_USUARIO,
  APAGAR_USUARIO,
  ATUALIZAR_USUARIO,
  CANCELAR_RESERVAS_FUTURAS_DO_USUARIO,
  CONTAR_RESERVAS_FUTURAS_DO_USUARIO,
  RESERVAS_FUTURAS_DO_USUARIO,
  BUSCAR_ID_POR_EMAIL,
  BUSCAR_USUARIO_PARA_ALTERAR,
  CONTAR_ADMINS_ATIVOS,
  CONTAR_OUTROS_ADMINS_ATIVOS,
  CRIAR_USUARIO,
  DESATIVAR_SEM_USO,
  LISTAR_USUARIOS,
  PROMOVER_E_REDEFINIR,
  REDEFINIR_SENHA,
  TRAVAR_ADMINISTRADORES,
} from './sql';

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  bloqueado: boolean;
  trocar_senha: boolean;
  ultimo_login_em: Date | null;
  criado_em: Date;
};

export function toUsuarioAdmin(row: UsuarioRow): UsuarioAdmin {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil,
    trocarSenha: row.trocar_senha,
    ativo: row.ativo,
    bloqueado: row.bloqueado,
    ultimoLoginEm: row.ultimo_login_em ? row.ultimo_login_em.toISOString() : null,
    criadoEm: row.criado_em.toISOString(),
  };
}

/** Contexto de quem está fazendo a alteração (para regras e auditoria). */
export interface Ator {
  id: string | null;
  ip: string | null;
}

const emailEmUso = () =>
  new AppError(409, ERROR_CODES.EMAIL_EM_USO, 'Já existe um usuário com este e-mail.', [
    { campo: 'email', mensagem: 'Já existe um usuário com este e-mail.' },
  ]);

const naoEncontrado = () =>
  new AppError(404, ERROR_CODES.USUARIO_NAO_ENCONTRADO, 'Usuário não encontrado.');

const naoPermitido = (mensagem: string) =>
  new AppError(409, ERROR_CODES.OPERACAO_NAO_PERMITIDA, mensagem);

async function revogarSessoes(q: Queryable, usuarioId: string) {
  await q.query(REMOVER_SESSOES_DO_USUARIO, [usuarioId, null]);
}

/**
 * Reservas futuras de quem vai ser desativado ou excluído. Sem decisão, devolve 409 com a
 * lista para o administrador escolher; com "cancelar", cancela todas e registra cada uma no
 * histórico. Devolve quantas foram canceladas. `pergunta` usa {total} para o número.
 */
async function decidirReservasFuturas(
  tx: Queryable,
  ator: Ator,
  usuario: { id: string },
  opcoes: { decisao: string | undefined; pergunta: string; motivo: string },
): Promise<number> {
  const { rows: contagem } = await tx.query<{ total: number }>(CONTAR_RESERVAS_FUTURAS_DO_USUARIO, [
    usuario.id,
  ]);
  const total = contagem[0]?.total ?? 0;
  if (total === 0) return 0;
  if (!opcoes.decisao) {
    const { rows: futuras } = await tx.query<{ id: string; inicio: Date; fim: Date; sala: string }>(
      RESERVAS_FUTURAS_DO_USUARIO,
      [usuario.id],
    );
    throw new AppError(
      409,
      ERROR_CODES.USUARIO_COM_RESERVAS_FUTURAS,
      opcoes.pergunta.replace('{total}', String(total)),
      {
        total,
        reservas: futuras.map((r) => ({
          id: r.id,
          inicio: r.inicio.toISOString(),
          fim: r.fim.toISOString(),
          sala: r.sala,
        })),
      },
    );
  }
  if (opcoes.decisao !== 'cancelar') return 0;
  const { rows: canceladas } = await tx.query<{ id: string }>(
    CANCELAR_RESERVAS_FUTURAS_DO_USUARIO,
    [usuario.id, ator.id, opcoes.motivo],
  );
  for (const r of canceladas) {
    await registrarAuditoria(tx, {
      atorId: ator.id,
      acao: 'RESERVA_CANCELADA',
      entidade: 'reserva',
      entidadeId: r.id,
      depois: { status: 'CANCELADA', motivoCancelamento: opcoes.motivo },
      ip: ator.ip,
    });
  }
  return canceladas.length;
}

export function createUsersService(database: Database) {
  const db = database.pool;

  return {
    async listar(): Promise<UsuarioAdmin[]> {
      const { rows } = await db.query<UsuarioRow>(LISTAR_USUARIOS);
      return rows.map(toUsuarioAdmin);
    },

    async criar(ator: Ator, dados: CriarUsuarioInput): Promise<UsuarioAdmin> {
      const senhaHash = await hashPassword(dados.senha);
      try {
        return await database.transaction(async (tx) => {
          const { rows } = await tx.query<UsuarioRow>(CRIAR_USUARIO, [
            dados.nome,
            dados.email,
            dados.perfil,
            senhaHash,
            true,
          ]);
          const usuario = toUsuarioAdmin(rows[0]!);
          await registrarAuditoria(tx, {
            atorId: ator.id,
            acao: 'USUARIO_CRIADO',
            entidade: 'usuario',
            entidadeId: usuario.id,
            depois: { nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
            ip: ator.ip,
          });
          return usuario;
        });
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION, 'usuarios_email_unico')) throw emailEmUso();
        throw error;
      }
    },

    async atualizar(
      ator: Ator,
      id: string,
      dados: AtualizarUsuarioInput,
    ): Promise<{ usuario: UsuarioAdmin; reservasCanceladas: number }> {
      try {
        return await database.transaction(async (tx) => {
          await tx.query(TRAVAR_ADMINISTRADORES);
          const { rows } = await tx.query<UsuarioRow>(BUSCAR_USUARIO_PARA_ALTERAR, [id]);
          const atual = rows[0];
          if (!atual) throw naoEncontrado();

          const deixaDeSerAdminAtivo =
            atual.perfil === 'ADMIN' &&
            atual.ativo &&
            (dados.ativo === false || dados.perfil === 'COLABORADOR');

          if (deixaDeSerAdminAtivo && ator.id === id) {
            throw naoPermitido(
              'Você não pode desativar o próprio usuário nem remover o seu perfil de administrador.',
            );
          }
          if (deixaDeSerAdminAtivo) {
            const { rows: contagem } = await tx.query<{ total: number }>(
              CONTAR_OUTROS_ADMINS_ATIVOS,
              [id],
            );
            if ((contagem[0]?.total ?? 0) === 0) {
              throw naoPermitido('É preciso manter pelo menos um administrador ativo.');
            }
          }

          // Desativar alguém com reservas futuras: o administrador decide o que fazer com elas.
          const reservasCanceladas =
            atual.ativo && dados.ativo === false
              ? await decidirReservasFuturas(tx, ator, atual, {
                  decisao: dados.reservasFuturas,
                  pergunta: `${atual.nome} tem {total} reserva(s) futura(s). Escolha se elas serão mantidas ou canceladas.`,
                  motivo: `Responsável (${atual.nome}) desativado pela administração.`,
                })
              : 0;

          const { rows: atualizados } = await tx.query<UsuarioRow>(ATUALIZAR_USUARIO, [
            id,
            dados.nome ?? null,
            dados.email ?? null,
            dados.perfil ?? null,
            dados.ativo ?? null,
          ]);
          const novo = toUsuarioAdmin(atualizados[0]!);
          const anterior = toUsuarioAdmin(atual);

          if (anterior.ativo && !novo.ativo) {
            // Desativar encerra o acesso imediatamente, em todos os navegadores.
            await revogarSessoes(tx, id);
          }

          const campos = ['nome', 'email', 'perfil', 'ativo'] as const;
          const antes: Record<string, unknown> = {};
          const depois: Record<string, unknown> = {};
          for (const campo of campos) {
            if (anterior[campo] !== novo[campo]) {
              antes[campo] = anterior[campo];
              depois[campo] = novo[campo];
            }
          }
          if (reservasCanceladas > 0) depois.reservasCanceladas = reservasCanceladas;

          if (Object.keys(depois).length > 0) {
            const acao =
              anterior.ativo && !novo.ativo
                ? 'USUARIO_DESATIVADO'
                : !anterior.ativo && novo.ativo
                  ? 'USUARIO_REATIVADO'
                  : 'USUARIO_ATUALIZADO';
            await registrarAuditoria(tx, {
              atorId: ator.id,
              acao,
              entidade: 'usuario',
              entidadeId: id,
              antes,
              depois,
              ip: ator.ip,
            });
          }
          return { usuario: novo, reservasCanceladas };
        });
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION, 'usuarios_email_unico')) throw emailEmUso();
        throw error;
      }
    },

    /**
     * Exclui a conta. Sem histórico, ela é apagada de verdade; com histórico (reservas ou
     * ações registradas), os dados pessoais são apagados e o resto fica como "Usuário
     * removido". Em ambos os casos o acesso termina na hora.
     */
    async excluir(
      ator: Ator,
      id: string,
      dados: ExcluirUsuarioInput,
    ): Promise<ExcluirUsuarioResponse> {
      if (ator.id === id) throw naoPermitido('Você não pode excluir a própria conta.');
      return database.transaction(async (tx) => {
        await tx.query(TRAVAR_ADMINISTRADORES);
        const { rows } = await tx.query<UsuarioRow>(BUSCAR_USUARIO_PARA_ALTERAR, [id]);
        const atual = rows[0];
        if (!atual) throw naoEncontrado();

        if (!nomeConfere(dados.confirmacao, atual.nome)) {
          const mensagem = `Para confirmar, digite o nome exatamente como está: ${atual.nome}.`;
          throw new AppError(400, ERROR_CODES.VALIDATION, mensagem, [
            { campo: 'confirmacao', mensagem },
          ]);
        }
        if (atual.perfil === 'ADMIN' && atual.ativo) {
          const { rows: contagem } = await tx.query<{ total: number }>(
            CONTAR_OUTROS_ADMINS_ATIVOS,
            [id],
          );
          if ((contagem[0]?.total ?? 0) === 0) {
            throw naoPermitido('É preciso manter pelo menos um administrador ativo.');
          }
        }

        // O motivo fica gravado na reserva: não repete o nome de quem está sendo excluído.
        const reservasCanceladas = await decidirReservasFuturas(tx, ator, atual, {
          decisao: dados.reservasFuturas,
          pergunta: `${atual.nome} tem {total} reserva(s) futura(s). Para excluir a conta, elas precisam ser canceladas.`,
          motivo: 'Responsável removido do sistema pela administração.',
        });

        await revogarSessoes(tx, id);
        let modo: ExcluirUsuarioResponse['modo'] = 'apagada';
        await tx.query('savepoint excluir_usuario');
        try {
          await tx.query(APAGAR_USUARIO, [id]);
        } catch (error) {
          // Tem reservas ou ações no histórico: apaga só os dados pessoais.
          if (!isPgError(error, PG_ERROR.FOREIGN_KEY_VIOLATION)) throw error;
          await tx.query('rollback to savepoint excluir_usuario');
          await tx.query(ANONIMIZAR_USUARIO, [id, NOME_USUARIO_REMOVIDO]);
          modo = 'anonimizada';
        }

        // Sem nome nem e-mail no registro: a exclusão não pode deixar os dados para trás.
        await registrarAuditoria(tx, {
          atorId: ator.id,
          acao: 'USUARIO_EXCLUIDO',
          entidade: 'usuario',
          entidadeId: id,
          antes: { perfil: atual.perfil, ativo: atual.ativo },
          depois: { modo, ...(reservasCanceladas > 0 ? { reservasCanceladas } : {}) },
          ip: ator.ip,
        });
        return { modo, reservasCanceladas };
      });
    },

    /** Libera uma conta bloqueada por senhas erradas, sem trocar a senha. */
    async desbloquear(ator: Ator, id: string): Promise<UsuarioAdmin> {
      return database.transaction(async (tx) => {
        const { rows } = await tx.query<UsuarioRow>(BUSCAR_USUARIO_PARA_ALTERAR, [id]);
        const usuario = rows[0];
        if (!usuario) throw naoEncontrado();
        if (!usuario.bloqueado) return toUsuarioAdmin(usuario);
        await tx.query(DESBLOQUEAR_USUARIO, [id]);
        await registrarAuditoria(tx, {
          atorId: ator.id,
          acao: 'CONTA_DESBLOQUEADA',
          entidade: 'usuario',
          entidadeId: id,
          antes: { bloqueado: true },
          depois: { bloqueado: false },
          ip: ator.ip,
        });
        return toUsuarioAdmin({ ...usuario, bloqueado: false });
      });
    },

    /** Define uma nova senha e encerra todas as sessões do usuário. */
    async redefinirSenha(ator: Ator, id: string, novaSenha: string): Promise<void> {
      if (ator.id === id) {
        throw naoPermitido('Para trocar a sua própria senha, use a página Minha conta.');
      }
      const senhaHash = await hashPassword(novaSenha);
      await database.transaction(async (tx) => {
        const { rows } = await tx.query<UsuarioRow>(BUSCAR_USUARIO_PARA_ALTERAR, [id]);
        const usuario = rows[0];
        if (!usuario) throw naoEncontrado();
        if (novaSenha.trim().toLowerCase() === usuario.email) {
          throw new AppError(400, ERROR_CODES.VALIDATION, 'A senha não pode ser igual ao e-mail.', [
            { campo: 'novaSenha', mensagem: 'A senha não pode ser igual ao e-mail.' },
          ]);
        }
        await tx.query(REDEFINIR_SENHA, [id, senhaHash]);
        await revogarSessoes(tx, id);
        await registrarAuditoria(tx, {
          atorId: ator.id,
          acao: 'SENHA_REDEFINIDA',
          entidade: 'usuario',
          entidadeId: id,
          ip: ator.ip,
        });
      });
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;

/**
 * Desativa os colaboradores que não entram no sistema há mais tempo que o configurado
 * (quem saiu da empresa perde o acesso). Roda periodicamente e no login. As reservas futuras
 * dessas pessoas são mantidas. Devolve quantas contas foram desativadas.
 */
export async function desativarContasSemUso(database: Database): Promise<number> {
  return database.transaction(async (tx) => {
    const { rows } = await tx.query<{
      id: string;
      nome: string;
      ultimo_acesso: Date;
      dias: number;
    }>(DESATIVAR_SEM_USO);
    for (const usuario of rows) {
      await revogarSessoes(tx, usuario.id);
      await registrarAuditoria(tx, {
        atorId: null,
        acao: 'USUARIO_DESATIVADO_INATIVIDADE',
        entidade: 'usuario',
        entidadeId: usuario.id,
        antes: { ativo: true },
        depois: {
          ativo: false,
          ultimoAcesso: usuario.ultimo_acesso.toISOString(),
          diasSemLogin: usuario.dias,
        },
      });
    }
    return rows.length;
  });
}

export class AdministradorJaExisteError extends Error {
  constructor() {
    super('Já existe um administrador ativo.');
    this.name = 'AdministradorJaExisteError';
  }
}

/**
 * Cria o primeiro administrador (comando de terminal `npm run admin:create`).
 * - Recusa se já houver administrador ativo, a menos que `forcar` seja true.
 * - Com `forcar` e um e-mail já cadastrado: promove esse usuário a administrador,
 *   reativa e define a nova senha (recuperação de acesso).
 */
export async function criarAdministrador(
  database: Database,
  dados: { nome: string; email: string; senha: string },
  opcoes: { forcar: boolean },
): Promise<{ usuario: UsuarioAdmin; recuperado: boolean }> {
  const senhaHash = await hashPassword(dados.senha);
  return database.transaction(async (tx) => {
    await tx.query(TRAVAR_ADMINISTRADORES);
    const { rows: contagem } = await tx.query<{ total: number }>(CONTAR_ADMINS_ATIVOS);
    if ((contagem[0]?.total ?? 0) > 0 && !opcoes.forcar) throw new AdministradorJaExisteError();

    const { rows: existente } = await tx.query<{ id: string }>(BUSCAR_ID_POR_EMAIL, [dados.email]);
    if (existente[0]) {
      if (!opcoes.forcar) throw emailEmUso();
      const { rows } = await tx.query<UsuarioRow>(PROMOVER_E_REDEFINIR, [
        existente[0].id,
        dados.nome,
        senhaHash,
      ]);
      const usuario = toUsuarioAdmin(rows[0]!);
      await revogarSessoes(tx, usuario.id);
      await registrarAuditoria(tx, {
        atorId: null,
        acao: 'ADMIN_RECUPERADO_TERMINAL',
        entidade: 'usuario',
        entidadeId: usuario.id,
        depois: { nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      });
      return { usuario, recuperado: true };
    }

    const { rows } = await tx.query<UsuarioRow>(CRIAR_USUARIO, [
      dados.nome,
      dados.email,
      'ADMIN',
      senhaHash,
      false,
    ]);
    const usuario = toUsuarioAdmin(rows[0]!);
    await registrarAuditoria(tx, {
      atorId: null,
      acao: 'ADMIN_CRIADO_TERMINAL',
      entidade: 'usuario',
      entidadeId: usuario.id,
      depois: { nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    });
    return { usuario, recuperado: false };
  });
}
