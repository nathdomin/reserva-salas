import { ERROR_CODES, nomeConfere, type UsuarioAdmin } from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { ApiError } from '../../lib/api';
import { formatDiaCurto, formatHorario } from '../../lib/format';
import { apiFieldErrors, errorMessage } from '../../lib/forms';
import { useExcluirUsuario } from './api';
import { EscolherDestinatario } from './EscolherDestinatario';

interface ReservasFuturas {
  total: number;
  reservas: { id: string; inicio: string; fim: string; sala: string }[];
}

interface ExcluirUsuarioProps {
  usuario: UsuarioAdmin;
  onCancel: () => void;
  onSaved: (mensagem: string, detalhe?: string) => void;
}

/**
 * Exclusão de conta: pede o nome da pessoa e, se ela tiver reservas futuras, se elas vão
 * para outra pessoa ou serão canceladas.
 */
export function ExcluirUsuario({ usuario, onCancel, onSaved }: ExcluirUsuarioProps) {
  const excluir = useExcluirUsuario();
  const [confirmacao, setConfirmacao] = useState('');
  const [futuras, setFuturas] = useState<ReservasFuturas | null>(null);
  const [destino, setDestino] = useState('');
  const confere = nomeConfere(confirmacao, usuario.nome);

  function enviar(
    event: Pick<FormEvent, 'preventDefault'>,
    reservasFuturas?: 'cancelar' | 'transferir',
  ) {
    event.preventDefault();
    if (!confere) return;
    excluir.mutate(
      {
        id: usuario.id,
        dados: {
          confirmacao,
          ...(reservasFuturas ? { reservasFuturas } : {}),
          ...(reservasFuturas === 'transferir' ? { transferirPara: destino } : {}),
        },
      },
      {
        onSuccess: ({ modo, reservasCanceladas, reservasTransferidas }) => {
          const reservas =
            reservasTransferidas > 0
              ? ` ${reservasTransferidas} reserva(s) futura(s) transferidas.`
              : reservasCanceladas > 0
                ? ` ${reservasCanceladas} reserva(s) futura(s) canceladas.`
                : '';
          onSaved(
            `A conta de ${usuario.nome} foi excluída.${reservas}`,
            modo === 'apagada'
              ? 'Ela não tinha histórico e foi apagada por completo.'
              : 'Nome, e-mail e senha foram apagados. Reservas e histórico continuam, como “Usuário removido”.',
          );
        },
        onError: (error) => {
          if (
            error instanceof ApiError &&
            error.code === ERROR_CODES.USUARIO_COM_RESERVAS_FUTURAS
          ) {
            setFuturas(error.details as ReservasFuturas);
          }
        },
      },
    );
  }

  const errosCampos = apiFieldErrors(excluir.error);
  const erroCampo = errosCampos.confirmacao;
  const mostrarErro =
    excluir.isError &&
    !erroCampo &&
    !errosCampos.transferirPara &&
    !(
      excluir.error instanceof ApiError &&
      excluir.error.code === ERROR_CODES.USUARIO_COM_RESERVAS_FUTURAS
    );

  return (
    <Panel title={`Excluir a conta de ${usuario.nome}`} className="mb-6">
      <form onSubmit={(e) => enviar(e)} noValidate className="flex flex-col gap-4">
        <div className="text-md">
          <p>Isto não pode ser desfeito. O acesso termina na hora, em todos os aparelhos.</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted">
            <li>Sem reservas nem ações no histórico: a conta é apagada por completo.</li>
            <li>
              Com histórico: nome, e-mail e senha são apagados, e as reservas e o histórico passam a
              mostrar “Usuário removido”.
            </li>
          </ul>
          <p className="mt-2 text-sm text-muted">
            Se a pessoa só deixou de usar o sistema, prefira <strong>Desativar</strong>: dá para
            reativar depois.
          </p>
        </div>

        {mostrarErro && (
          <Alert tone="error" title={errorMessage(excluir.error)} className="bg-canvas" />
        )}

        {futuras && (
          <Alert
            tone="error"
            title={`${usuario.nome} tem ${futuras.total} reserva(s) futura(s). Para excluir a conta, transfira ou cancele essas reservas.`}
            className="bg-canvas"
            action={
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="sm:w-72">
                    <EscolherDestinatario
                      excluirId={usuario.id}
                      valor={destino}
                      onChange={setDestino}
                      erro={errosCampos.transferirPara}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={excluir.isPending || !confere || !destino}
                    onClick={(e) => enviar(e, 'transferir')}
                  >
                    Transferir as reservas e excluir
                  </Button>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={excluir.isPending || !confere}
                    onClick={(e) => enviar(e, 'cancelar')}
                  >
                    Cancelar as reservas e excluir
                  </Button>
                </div>
              </div>
            }
          >
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {futuras.reservas.map((r) => (
                <li key={r.id}>
                  {formatDiaCurto(r.inicio)}, {formatHorario(r.inicio, r.fim, false)}: {r.sala}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <Field label={`Para confirmar, digite o nome: ${usuario.nome}`} error={erroCampo}>
          <Input
            value={confirmacao}
            autoComplete="off"
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {!futuras && (
            <Button type="submit" variant="danger" disabled={excluir.isPending || !confere}>
              {excluir.isPending ? 'Excluindo…' : 'Excluir conta'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onCancel}>
            Voltar
          </Button>
        </div>
      </form>
    </Panel>
  );
}
