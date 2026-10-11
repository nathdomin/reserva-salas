import { STATUS_RESERVA_LABEL } from '@reserva/shared';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { Spinner } from '../components/ui/Spinner';
import { useAuditoria } from '../features/auditoria/api';
import { HistoricoLista } from '../features/auditoria/HistoricoLista';
import { useSessao } from '../features/auth/session';
import { useReserva } from '../features/reservas/api';
import { CancelarReserva } from '../features/reservas/CancelarReserva';
import { formatDateTime, formatHorario, formatLongDate } from '../lib/format';
import { errorMessage } from '../lib/forms';

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{rotulo}</dt>
      <dd className="text-[15px] font-medium">{children}</dd>
    </div>
  );
}

export function ReservationDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const aviso = (location.state as { aviso?: string } | null)?.aviso;
  const { data: usuario } = useSessao();
  const reserva = useReserva(id);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelada, setCancelada] = useState(false);

  const r = reserva.data;
  const deOutraPessoa = Boolean(r && usuario && r.responsavel.id !== usuario.id);
  // Quem chegou por um link direto não tem para onde "voltar": vai para o início.
  const temHistorico = location.key !== 'default';

  return (
    <>
      <button
        type="button"
        onClick={() => (temHistorico ? navigate(-1) : navigate('/'))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Voltar
      </button>

      {reserva.isPending && <Spinner label="Carregando reserva" />}
      {reserva.isError && <Alert tone="error" title={errorMessage(reserva.error)} />}

      {r && (
        <>
          <PageHeader
            title={r.motivo}
            description={`${r.sala.nome}, ${formatLongDate(r.inicio)}`}
            actions={
              r.podeEditar ? (
                <ButtonLink to={`/reservas/${r.id}/editar`} variant="secondary">
                  <Pencil aria-hidden className="size-4" />
                  Editar
                </ButtonLink>
              ) : undefined
            }
          />

          {aviso && !cancelada && <Alert tone="success" title={aviso} className="mb-6" />}
          {cancelada && (
            <Alert
              tone="success"
              title="Reserva cancelada. O horário ficou livre para outras pessoas."
              className="mb-6"
            />
          )}

          <Panel>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge tone={r.status === 'ATIVA' ? 'strong' : 'muted'}>
                {STATUS_RESERVA_LABEL[r.status]}
              </Badge>
              {r.diaInteiro && <Badge>Dia inteiro</Badge>}
              {r.motivoOculto && <Badge>Motivo visível só para o responsável</Badge>}
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info rotulo="Sala">
                {r.sala.nome}, {r.sala.localizacao}
              </Info>
              <Info rotulo="Data">{formatLongDate(r.inicio)}</Info>
              <Info rotulo="Horário">{formatHorario(r.inicio, r.fim, r.diaInteiro)}</Info>
              <Info rotulo="Responsável">{r.responsavel.nome}</Info>
              <Info rotulo="Participantes previstos">{r.participantes ?? 'Não informado'}</Info>
              <Info rotulo="Criada em">{formatDateTime(r.criadoEm)}</Info>
              <Info rotulo="Última atualização">{formatDateTime(r.atualizadoEm)}</Info>
              {r.status === 'CANCELADA' && r.canceladaEm && (
                <Info rotulo="Cancelada em">{formatDateTime(r.canceladaEm)}</Info>
              )}
              {r.status === 'CANCELADA' && r.motivoCancelamento && (
                <Info rotulo="Motivo do cancelamento">{r.motivoCancelamento}</Info>
              )}
            </dl>

            {r.podeCancelar && !confirmando && (
              <div className="mt-6 border-t border-line pt-4">
                <Button variant="ghost" onClick={() => setConfirmando(true)}>
                  Cancelar reserva
                </Button>
              </div>
            )}

            {r.podeCancelar && confirmando && (
              <CancelarReserva
                reserva={r}
                deOutraPessoa={deOutraPessoa}
                className="mt-6 border-t border-line pt-4"
                onCancelada={() => {
                  setConfirmando(false);
                  setCancelada(true);
                }}
                onVoltar={() => setConfirmando(false)}
              />
            )}
          </Panel>

          {usuario?.perfil === 'ADMIN' && <HistoricoDaReserva id={r.id} />}
        </>
      )}
    </>
  );
}

/** Criação, alterações e cancelamento desta reserva (visível só para o administrador). */
function HistoricoDaReserva({ id }: { id: string }) {
  const historico = useAuditoria({ entidade: 'reserva', entidadeId: id }, { limite: 20 });
  const registros = historico.data?.pages.flatMap((p) => p.registros) ?? [];
  return (
    <Panel title="Histórico desta reserva" className="mt-6">
      {historico.isPending && <Spinner label="Carregando histórico" />}
      {historico.isError && <Alert tone="error" title={errorMessage(historico.error)} />}
      {historico.isSuccess && registros.length === 0 && (
        <p className="text-sm text-muted">Nenhum registro.</p>
      )}
      {registros.length > 0 && <HistoricoLista registros={registros} mostrarAlvo={false} />}
    </Panel>
  );
}
