import { ERROR_CODES, type Sala } from '@reserva/shared';
import { DoorOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { useAtualizarSala, useSalas } from '../../features/salas/api';
import { SalaForm } from '../../features/salas/SalaForm';
import { ApiError } from '../../lib/api';
import { formatDiaCurto, formatHorario } from '../../lib/format';
import { errorMessage } from '../../lib/forms';
import { avisar } from '../../features/avisos/store';
import { SkeletonLista } from '../../components/ui/Skeleton';

type Painel = { tipo: 'criar' } | { tipo: 'editar'; sala: Sala } | null;

interface ReservasFuturas {
  sala: Sala;
  total: number;
  reservas: { id: string; inicio: string; fim: string; responsavel: string }[];
}

export function RoomsPage() {
  const salas = useSalas(true);
  const atualizar = useAtualizarSala();
  const [painel, setPainel] = useState<Painel>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<ReservasFuturas | null>(null);

  function limparMensagens() {
    setErro(null);
  }

  function desativar(sala: Sala, reservasFuturas?: 'manter' | 'cancelar') {
    limparMensagens();
    atualizar.mutate(
      { id: sala.id, dados: { ativo: false, ...(reservasFuturas ? { reservasFuturas } : {}) } },
      {
        onSuccess: ({ reservasCanceladas }) => {
          setConfirmando(null);
          setDecisao(null);
          avisar(
            reservasCanceladas > 0
              ? `Sala ${sala.nome} desativada e ${reservasCanceladas} reserva(s) futura(s) cancelada(s).`
              : `Sala ${sala.nome} desativada. Ela não recebe novas reservas; o histórico foi mantido.`,
          );
        },
        onError: (error) => {
          setConfirmando(null);
          if (error instanceof ApiError && error.code === ERROR_CODES.SALA_COM_RESERVAS_FUTURAS) {
            const d = error.details as Omit<ReservasFuturas, 'sala'>;
            setDecisao({ sala, total: d.total, reservas: d.reservas });
            return;
          }
          setErro(errorMessage(error));
        },
      },
    );
  }

  function reativar(sala: Sala) {
    limparMensagens();
    atualizar.mutate(
      { id: sala.id, dados: { ativo: true } },
      {
        onSuccess: () => avisar(`Sala ${sala.nome} reativada.`),
        onError: (error) => setErro(errorMessage(error)),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Salas"
        description="Salas de reunião disponíveis para reserva e seus recursos."
        actions={
          <Button
            onClick={() => {
              limparMensagens();
              setPainel({ tipo: 'criar' });
            }}
          >
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
            Nova sala
          </Button>
        }
      />

      {erro && <Alert tone="error" title={erro} className="mb-6" />}

      {decisao && (
        <Panel title={`Desativar ${decisao.sala.nome}`} className="mb-6">
          <p className="text-md">
            Esta sala tem <strong>{decisao.total} reserva(s) futura(s)</strong>. O que fazer com
            elas?
          </p>
          <ul className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
            {decisao.reservas.map((r) => (
              <li key={r.id}>
                {formatDiaCurto(r.inicio)}, {formatHorario(r.inicio, r.fim, false)}: {r.responsavel}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => desativar(decisao.sala, 'cancelar')}
              disabled={atualizar.isPending}
            >
              Desativar e cancelar as reservas
            </Button>
            <Button
              variant="secondary"
              onClick={() => desativar(decisao.sala, 'manter')}
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

      {painel?.tipo === 'criar' && (
        <SalaForm
          onCancel={() => setPainel(null)}
          onSaved={(m) => {
            setPainel(null);
            avisar(m);
          }}
        />
      )}
      {painel?.tipo === 'editar' && (
        <SalaForm
          key={painel.sala.id}
          sala={painel.sala}
          onCancel={() => setPainel(null)}
          onSaved={(m) => {
            setPainel(null);
            avisar(m);
          }}
        />
      )}

      {salas.isPending && <SkeletonLista label="Carregando salas" linhas={3} />}
      {salas.isError && <Alert tone="error" title={errorMessage(salas.error)} />}

      {salas.isSuccess && salas.data.length === 0 && (
        <Panel>
          <EmptyState
            icon={DoorOpen}
            title="Nenhuma sala cadastrada"
            description="Cadastre as salas de reunião para que os colaboradores possam reservá-las."
          />
        </Panel>
      )}

      {salas.isSuccess && salas.data.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="Lista de salas">
          {salas.data.map((s) => (
            <li
              key={s.id}
              className="flex flex-col rounded-xl border border-line bg-paper shadow-card p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{s.nome}</h2>
                {!s.ativo && <Badge tone="muted">Desativada</Badge>}
              </div>
              <p className="text-sm text-muted">
                {s.localizacao}. Até {s.capacidade} pessoas.
              </p>
              {s.recursos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Recursos">
                  {s.recursos.map((r) => (
                    <Badge key={r}>{r}</Badge>
                  ))}
                </div>
              )}
              {s.descricao && <p className="mt-3 text-sm">{s.descricao}</p>}

              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                {confirmando === s.id ? (
                  <>
                    <span className="w-full text-sm">
                      Desativar {s.nome}? Ela deixa de receber novas reservas.
                    </span>
                    <Button size="sm" onClick={() => desativar(s)} disabled={atualizar.isPending}>
                      Confirmar desativação
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmando(null)}>
                      Voltar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        limparMensagens();
                        setPainel({ tipo: 'editar', sala: s });
                      }}
                    >
                      Editar
                    </Button>
                    {s.ativo ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          limparMensagens();
                          setConfirmando(s.id);
                        }}
                      >
                        Desativar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reativar(s)}
                        disabled={atualizar.isPending}
                      >
                        Reativar
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
