import { ERROR_CODES, PERFIL_LABEL, type UsuarioAdmin } from '@reserva/shared';
import { Plus, SearchX, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, Input, Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { useSessao } from '../../features/auth/session';
import { useAtualizarUsuario, useDesbloquearUsuario, useUsuarios } from '../../features/users/api';
import { ResetPasswordForm, UserForm } from '../../features/users/UserForms';
import { ApiError } from '../../lib/api';
import { formatDateTime, formatDiaCurto, formatHorario } from '../../lib/format';
import { errorMessage } from '../../lib/forms';
import { avisar } from '../../features/avisos/store';
import { SkeletonLista } from '../../components/ui/Skeleton';

type Painel =
  | { tipo: 'criar' }
  | { tipo: 'editar'; usuario: UsuarioAdmin }
  | { tipo: 'senha'; usuario: UsuarioAdmin }
  | null;

type FiltroStatus = 'todos' | 'ativos' | 'inativos';

interface ReservasFuturas {
  usuario: UsuarioAdmin;
  total: number;
  reservas: { id: string; inicio: string; fim: string; sala: string }[];
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function UsersPage() {
  const { data: sessao } = useSessao();
  const usuarios = useUsuarios();
  const atualizar = useAtualizarUsuario();
  const desbloquear = useDesbloquearUsuario();

  const [painel, setPainel] = useState<Painel>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<ReservasFuturas | null>(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatus>('ativos');

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (usuarios.data ?? []).filter((u) => {
      if (status === 'ativos' && !u.ativo) return false;
      if (status === 'inativos' && u.ativo) return false;
      return !termo || normalizar(`${u.nome} ${u.email}`).includes(termo);
    });
  }, [usuarios.data, busca, status]);

  function abrir(novo: Painel) {
    setPainel(novo);
    setErroAcao(null);
    setConfirmando(null);
    setDecisao(null);
  }

  function concluir(mensagem: string) {
    setPainel(null);
    avisar(mensagem);
  }

  function alterarStatus(
    usuario: UsuarioAdmin,
    ativo: boolean,
    reservasFuturas?: 'manter' | 'cancelar',
  ) {
    setErroAcao(null);
    atualizar.mutate(
      { id: usuario.id, dados: { ativo, ...(reservasFuturas ? { reservasFuturas } : {}) } },
      {
        onSuccess: ({ usuario: u, reservasCanceladas }) => {
          setConfirmando(null);
          setDecisao(null);
          avisar(
            ativo
              ? `${u.nome} foi reativado(a) e já pode entrar no sistema.`
              : reservasCanceladas > 0
                ? `${u.nome} foi desativado(a) e ${reservasCanceladas} reserva(s) futura(s) foram canceladas.`
                : `${u.nome} foi desativado(a). As sessões abertas foram encerradas.`,
          );
        },
        onError: (error) => {
          setConfirmando(null);
          if (
            error instanceof ApiError &&
            error.code === ERROR_CODES.USUARIO_COM_RESERVAS_FUTURAS
          ) {
            const d = error.details as Omit<ReservasFuturas, 'usuario'>;
            setDecisao({ usuario, total: d.total, reservas: d.reservas });
            return;
          }
          setErroAcao(errorMessage(error));
        },
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem pode acessar o sistema e com qual perfil."
        actions={
          <Button onClick={() => abrir({ tipo: 'criar' })}>
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
            Novo usuário
          </Button>
        }
      />

      {erroAcao && <Alert tone="error" title={erroAcao} className="mb-6" />}

      {decisao && (
        <Panel title={`Desativar ${decisao.usuario.nome}`} className="mb-6">
          <p className="text-md">
            {decisao.usuario.nome} tem <strong>{decisao.total} reserva(s) futura(s)</strong>. O que
            fazer com elas?
          </p>
          <ul className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
            {decisao.reservas.map((r) => (
              <li key={r.id}>
                {formatDiaCurto(r.inicio)}, {formatHorario(r.inicio, r.fim, false)}: {r.sala}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => alterarStatus(decisao.usuario, false, 'cancelar')}
              disabled={atualizar.isPending}
            >
              Desativar e cancelar as reservas
            </Button>
            <Button
              variant="secondary"
              onClick={() => alterarStatus(decisao.usuario, false, 'manter')}
              disabled={atualizar.isPending}
            >
              Desativar e manter as reservas
            </Button>
            <Button variant="ghost" onClick={() => setDecisao(null)}>
              Voltar
            </Button>
          </div>
        </Panel>
      )}

      {painel?.tipo === 'criar' && <UserForm onCancel={() => setPainel(null)} onSaved={concluir} />}
      {painel?.tipo === 'editar' && (
        <UserForm
          key={painel.usuario.id}
          usuario={painel.usuario}
          ehVoceMesmo={painel.usuario.id === sessao?.id}
          onCancel={() => setPainel(null)}
          onSaved={concluir}
        />
      )}
      {painel?.tipo === 'senha' && (
        <ResetPasswordForm
          key={painel.usuario.id}
          usuario={painel.usuario}
          onCancel={() => setPainel(null)}
          onSaved={concluir}
        />
      )}

      <Panel>
        <div className="mb-2 grid gap-3 sm:grid-cols-[1fr_200px]">
          <Field label="Buscar por nome ou e-mail">
            <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </Field>
          <Field label="Situação">
            <Select value={status} onChange={(e) => setStatus(e.target.value as FiltroStatus)}>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </Select>
          </Field>
        </div>

        {usuarios.isPending && <SkeletonLista label="Carregando usuários" cartao={false} />}

        {usuarios.isError && (
          <Alert
            tone="error"
            title="Não foi possível carregar os usuários"
            className="mt-4 bg-canvas"
            action={
              <Button variant="secondary" size="sm" onClick={() => usuarios.refetch()}>
                Tentar de novo
              </Button>
            }
          >
            {errorMessage(usuarios.error)}
          </Alert>
        )}

        {usuarios.isSuccess && filtrados.length === 0 && (
          <EmptyState
            icon={usuarios.data.length === 0 ? Users : SearchX}
            title={
              usuarios.data.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum usuário encontrado'
            }
            description={
              usuarios.data.length === 0
                ? 'Cadastre as pessoas que vão usar o sistema.'
                : 'Ajuste a busca ou a situação selecionada.'
            }
          />
        )}

        {usuarios.isSuccess && filtrados.length > 0 && (
          <ul className="divide-y divide-line" aria-label="Lista de usuários">
            {filtrados.map((u) => {
              const ehVoce = u.id === sessao?.id;
              return (
                <li
                  key={u.id}
                  className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {u.nome}
                        {ehVoce && <span className="text-sm font-normal text-muted"> (você)</span>}
                      </span>
                      <Badge tone={u.perfil === 'ADMIN' ? 'strong' : 'neutral'}>
                        {PERFIL_LABEL[u.perfil]}
                      </Badge>
                      {!u.ativo && <Badge tone="muted">Inativo</Badge>}
                      {u.bloqueado && <Badge tone="warn">Bloqueado por tentativas</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">{u.email}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {u.ultimoLoginEm
                        ? `Último acesso: ${formatDateTime(u.ultimoLoginEm)}`
                        : 'Ainda não entrou no sistema'}
                    </p>
                  </div>

                  {confirmando === u.id ? (
                    <div className="flex flex-wrap items-center gap-2" role="group">
                      <span className="text-sm">
                        Desativar {u.nome}? O acesso é encerrado na hora.
                      </span>
                      <Button
                        size="sm"
                        onClick={() => alterarStatus(u, false)}
                        disabled={atualizar.isPending}
                      >
                        {atualizar.isPending ? 'Desativando…' : 'Confirmar desativação'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmando(null)}>
                        Voltar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => abrir({ tipo: 'editar', usuario: u })}
                      >
                        Editar
                      </Button>
                      {u.bloqueado && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={desbloquear.isPending}
                          onClick={() => {
                            setErroAcao(null);
                            desbloquear.mutate(u.id, {
                              onSuccess: (d) =>
                                avisar(
                                  `${d.nome} foi desbloqueado(a) e já pode entrar.`,
                                  'As tentativas com senha errada ficam no Histórico, com o IP de origem.',
                                ),
                              onError: (error) => setErroAcao(errorMessage(error)),
                            });
                          }}
                        >
                          Desbloquear
                        </Button>
                      )}
                      {!ehVoce && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => abrir({ tipo: 'senha', usuario: u })}
                        >
                          Redefinir senha
                        </Button>
                      )}
                      {!ehVoce && u.ativo && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setConfirmando(u.id);
                          }}
                        >
                          Desativar
                        </Button>
                      )}
                      {!u.ativo && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => alterarStatus(u, true)}
                          disabled={atualizar.isPending}
                        >
                          Reativar
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
